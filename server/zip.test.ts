import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { readZipEntries } from "./zip.ts";

/** A conforming writer, used to build fixtures. Kept minimal and separate
 * from the reader so a bug in one cannot hide a bug in the other by
 * symmetry — the reader also verifies CRC-32, which this computes
 * independently through a different code path (zlib's own table). */
function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

interface FixtureEntry {
  name: string;
  data: Buffer;
  deflate?: boolean;
  mode?: number;
  /** Zero the local header's sizes and CRC, as a streaming writer does. */
  dataDescriptor?: boolean;
}

function buildZip(entries: FixtureEntry[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const stored = entry.deflate ? deflateRawSync(entry.data) : entry.data;
    const crc = crc32(entry.data);
    const flags = entry.dataDescriptor ? 0x8 : 0;

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(entry.dataDescriptor ? 0 : crc, 14);
    local.writeUInt32LE(entry.dataDescriptor ? 0 : stored.length, 18);
    local.writeUInt32LE(entry.dataDescriptor ? 0 : entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, stored);

    const trailer = Buffer.alloc(entry.dataDescriptor ? 16 : 0);
    if (entry.dataDescriptor) {
      trailer.writeUInt32LE(0x08074b50, 0);
      trailer.writeUInt32LE(crc, 4);
      trailer.writeUInt32LE(stored.length, 8);
      trailer.writeUInt32LE(entry.data.length, 12);
      locals.push(trailer);
    }

    const header = Buffer.alloc(46 + name.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(0x0314, 4); // written on unix
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flags, 8);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(stored.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(((entry.mode ?? 0o644) << 16) >>> 0, 38);
    header.writeUInt32LE(offset, 42);
    name.copy(header, 46);
    central.push(header);

    offset += local.length + stored.length + trailer.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe("zip reader", () => {
  it("reads stored and deflated entries and keeps their unix mode", () => {
    const zip = buildZip([
      { name: "cua_driver/bin/cua-driver", data: Buffer.from("#!/bin/sh\n"), mode: 0o755 },
      { name: "cua_driver-0.20.0.dist-info/RECORD", data: Buffer.from("x".repeat(5000)), deflate: true },
    ]);
    const entries = readZipEntries(zip, () => true);
    expect(entries.map((entry) => entry.name)).toEqual([
      "cua_driver/bin/cua-driver",
      "cua_driver-0.20.0.dist-info/RECORD",
    ]);
    expect(entries[0].data.toString()).toBe("#!/bin/sh\n");
    expect(entries[0].mode & 0o777).toBe(0o755);
    expect(entries[1].data).toHaveLength(5000);
  });

  it("reads sizes from the central directory, not the local header", () => {
    // A streaming writer zeroes the local header and trails a data
    // descriptor. Trusting the local header here would inflate zero bytes
    // and silently produce an empty binary.
    const zip = buildZip([
      { name: "cua_driver/bin/cua-driver", data: Buffer.from("real contents"), deflate: true, dataDescriptor: true },
    ]);
    expect(readZipEntries(zip, () => true)[0].data.toString()).toBe("real contents");
  });

  it("only inflates the entries asked for", () => {
    const zip = buildZip([
      { name: "keep", data: Buffer.from("yes") },
      { name: "skip", data: Buffer.from("no") },
    ]);
    expect(readZipEntries(zip, (name) => name === "keep").map((entry) => entry.name)).toEqual(["keep"]);
  });

  it("refuses a corrupted entry rather than returning wrong bytes", () => {
    const zip = buildZip([{ name: "cua-driver", data: Buffer.from("original") }]);
    // Flip a byte inside the stored payload, leaving the CRC in the
    // directory intact.
    const at = zip.indexOf(Buffer.from("original"));
    zip[at] = zip[at] ^ 0xff;
    expect(() => readZipEntries(zip, () => true)).toThrow("CRC");
  });

  it("refuses archives it cannot read honestly", () => {
    expect(() => readZipEntries(Buffer.from("not a zip at all"), () => true)).toThrow("not a zip archive");
    const encrypted = buildZip([{ name: "a", data: Buffer.from("x") }]);
    // Set the encryption flag in the central directory header.
    const directoryAt = encrypted.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    encrypted.writeUInt16LE(0x1, directoryAt + 8);
    expect(() => readZipEntries(encrypted, () => true)).toThrow("encrypted");
  });
});
