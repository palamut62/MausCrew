// A minimal ZIP reader, for exactly one job: pulling the cua-driver binary
// out of the pinned Python wheel the Local VM already installs.
//
// A wheel is a plain ZIP. Node has no archive reader, and the alternatives
// were worse than 100 lines: shelling out to `unzip` or `python3 -m zipfile`
// makes desktop control depend on which tools a distro happens to ship, and a
// third-party package would be a new dependency in the trust path of
// something that ends up executable on the user's machine.
//
// Deliberately narrow. It reads the central directory (never the local
// headers' sizes, which may be zeroed in favour of a trailing data
// descriptor), supports stored and deflated entries, and verifies CRC-32 on
// every entry it returns. Encryption, ZIP64, and multi-disk archives are
// refused rather than half-handled.
import { inflateRawSync } from "node:zlib";

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const ZIP64_LOCATOR = 0x07064b50;

const STORED = 0;
const DEFLATED = 8;
/** Bit 0 of the general-purpose flags. */
const ENCRYPTED = 0x1;

export interface ZipEntry {
  name: string;
  /** Unix mode from the external attributes, or 0 when the archive was not
   * written on a Unix host. The executable bit is why this is read at all. */
  mode: number;
  data: Buffer;
}

function crc32(buffer: Buffer): number {
  // Table built once per call site rather than kept module-global: this runs
  // a handful of times per install, and a lazily-shared table is a mutable
  // module singleton for no measurable gain.
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The comment field is up to 64 KiB, so the record is somewhere in the last
  // 64 KiB + 22 bytes. Scan backwards for the signature.
  const start = Math.max(0, buffer.length - 0x10016);
  for (let at = buffer.length - 22; at >= start; at -= 1) {
    if (buffer.readUInt32LE(at) === END_OF_CENTRAL_DIRECTORY) return at;
  }
  throw new Error("not a zip archive");
}

/**
 * Every entry whose name passes `wanted`, decompressed and CRC-checked.
 *
 * Filtering during the walk rather than after means a 40 MB wheel costs one
 * inflate for the one file we came for.
 */
export function readZipEntries(buffer: Buffer, wanted: (name: string) => boolean): ZipEntry[] {
  const end = findEndOfCentralDirectory(buffer);
  if (buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) {
    throw new Error("multi-disk zip archives are not supported");
  }
  const count = buffer.readUInt16LE(end + 10);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  if (directoryOffset === 0xffffffff || count === 0xffff) {
    throw new Error("zip64 archives are not supported");
  }
  // A ZIP64 locator immediately before the record means the 32-bit fields
  // above are placeholders even when they do not read as 0xffffffff.
  if (end >= 20 && buffer.readUInt32LE(end - 20) === ZIP64_LOCATOR) {
    throw new Error("zip64 archives are not supported");
  }

  const entries: ZipEntry[] = [];
  let at = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== CENTRAL_FILE_HEADER) {
      throw new Error("zip central directory is corrupt");
    }
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const compressedSize = buffer.readUInt32LE(at + 20);
    const uncompressedSize = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const externalAttributes = buffer.readUInt32LE(at + 38);
    const localOffset = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;

    if (!wanted(name)) continue;
    if (flags & ENCRYPTED) throw new Error(`${name} is encrypted`);
    if (method !== STORED && method !== DEFLATED) {
      throw new Error(`${name} uses unsupported compression method ${method}`);
    }
    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      throw new Error(`${name} has no local header`);
    }
    // The local header's own name/extra lengths are the authoritative ones —
    // writers are allowed to store different extra fields in each place.
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === DEFLATED ? inflateRawSync(raw) : Buffer.from(raw);
    if (data.length !== uncompressedSize) throw new Error(`${name} has an unexpected size`);
    if (crc32(data) !== crc) throw new Error(`${name} failed its CRC check`);
    entries.push({ name, mode: (externalAttributes >>> 16) & 0xffff, data });
  }
  return entries;
}
