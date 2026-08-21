import { describe, expect, it } from "vitest";

import { checkAguiEndpoint, type EndpointResolver } from "./endpoint.ts";

const resolvesTo = (address: string): EndpointResolver => async () => [
  { address, family: address.includes(":") ? 6 : 4 },
];

describe("checkAguiEndpoint", () => {
  it("requires HTTPS for public agents", async () => {
    await expect(checkAguiEndpoint("http://agent.example/run", { resolver: resolvesTo("203.0.113.8") }))
      .resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("HTTPS") });
    await expect(checkAguiEndpoint("https://agent.example/run", { resolver: resolvesTo("203.0.113.8") }))
      .resolves.toEqual({ allowed: true, url: "https://agent.example/run" });
  });

  it("allows local development only when private hosts are enabled", async () => {
    await expect(checkAguiEndpoint("http://127.0.0.1:8000/ag-ui"))
      .resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("Private-network") });
    await expect(checkAguiEndpoint("http://127.0.0.1:8000/ag-ui", { allowPrivateHosts: true }))
      .resolves.toEqual({ allowed: true, url: "http://127.0.0.1:8000/ag-ui" });
  });

  it("never permits metadata services, even in private-host mode", async () => {
    await expect(checkAguiEndpoint("http://169.254.169.254/latest/meta-data", { allowPrivateHosts: true }))
      .resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("metadata") });
    await expect(checkAguiEndpoint("https://agent.example/run", {
      allowPrivateHosts: true,
      resolver: resolvesTo("169.254.169.254"),
    })).resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("metadata") });
  });

  it("rejects embedded credentials and URL fragments", async () => {
    await expect(checkAguiEndpoint("https://token@agent.example/run", { resolver: resolvesTo("203.0.113.8") }))
      .resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("credentials") });
    await expect(checkAguiEndpoint("https://agent.example/run#secret", { resolver: resolvesTo("203.0.113.8") }))
      .resolves.toMatchObject({ allowed: false, reason: expect.stringContaining("fragment") });
  });
});
