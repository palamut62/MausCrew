import { mkdirSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { DATA_DIR } from "./config.ts";
import {
  authenticateRemoteToken,
  claimPairing,
  cookieToken,
  createPairing,
  listRemoteDevices,
  revokeRemoteDevice,
} from "./remote-access.ts";

describe("remote device pairing", () => {
  beforeAll(() => mkdirSync(DATA_DIR, { recursive: true }));

  it("exchanges a one-time code for a revocable opaque device token", () => {
    const pairing = createPairing();
    const claimed = claimPairing(pairing.code.toLowerCase(), "Umut's phone", "test-client");
    expect(claimed).not.toBeNull();
    expect(claimed).not.toBe("rate-limited");
    if (!claimed || claimed === "rate-limited") return;

    expect(claimPairing(pairing.code, "Replay", "test-client")).toBeNull();
    expect(cookieToken(`theme=dark; mauscrew_remote=${encodeURIComponent(claimed.token)}`)).toBe(claimed.token);
    expect(authenticateRemoteToken(claimed.token)?.id).toBe(claimed.device.id);
    expect(listRemoteDevices()).toEqual([expect.objectContaining({ name: "Umut's phone" })]);
    expect(listRemoteDevices()[0]).not.toHaveProperty("tokenHash");

    expect(revokeRemoteDevice(claimed.device.id)).toBe(true);
    expect(authenticateRemoteToken(claimed.token)).toBeNull();
  });
});
