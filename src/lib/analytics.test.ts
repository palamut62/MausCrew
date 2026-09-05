import { beforeEach, expect, it, vi } from "vitest";
const client = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), identify: vi.fn(), opt_out_capturing: vi.fn(), opt_in_capturing: vi.fn() }));
vi.mock("posthog-js", () => ({ default: client }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => "present", setItem: vi.fn() });
  vi.stubGlobal("navigator", { userAgent: "test" });
});
it("does not initialize when disabled and stops immediately after opt-out", async () => {
  const analytics = await import("./analytics");
  await analytics.initAnalytics(false);
  expect(client.init).not.toHaveBeenCalled();
  await analytics.initAnalytics(true);
  client.capture.mockClear();
  await analytics.initAnalytics(false);
  analytics.track("message_sent");
  analytics.identifyEmail("local@example.test");
  expect(client.capture).not.toHaveBeenCalled();
  expect(client.identify).not.toHaveBeenCalled();
  expect(client.opt_out_capturing).toHaveBeenCalled();
  await analytics.initAnalytics(true);
  analytics.track("enabled_again");
  expect(client.capture).toHaveBeenCalledWith("enabled_again", undefined);
});
it("does not initialize a lazy import that was disabled in flight", async () => {
  const analytics = await import("./analytics");
  const opening = analytics.initAnalytics(true);
  await analytics.initAnalytics(false);
  await opening;
  expect(client.init).not.toHaveBeenCalled();
});
