import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { orderedServerPorts, readSavedServerPort, saveServerPort } from "./server-port.mjs";

test("saved packaged server port is tried first", () => {
  assert.deepEqual(orderedServerPorts(28799), [28799, 8799, 18799]);
  assert.deepEqual(orderedServerPorts(9999), [8799, 18799, 28799]);
});

test("packaged server port survives restarts and ignores corrupt state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mauscrew-port-"));
  try {
    saveServerPort(dir, 18799);
    assert.equal(readSavedServerPort(dir), 18799);
    saveServerPort(dir, 28799);
    assert.equal(readSavedServerPort(dir), 28799);
    fs.writeFileSync(path.join(dir, "server-port.json"), "not-json");
    assert.equal(readSavedServerPort(dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
