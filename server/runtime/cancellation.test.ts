import { describe, expect, it } from "vitest";

import { CancellationScope } from "./cancellation.ts";

describe("CancellationScope", () => {
  it("propagates cancellation through the whole child tree", () => {
    const root = new CancellationScope();
    const task = root.child();
    const tool = task.child();
    const reason = new Error("stop all");
    root.cancel(reason);
    expect(root.signal.reason).toBe(reason);
    expect(task.signal.reason).toBe(reason);
    expect(tool.signal.reason).toBe(reason);
  });

  it("lets a disposed child leave the parent tree", () => {
    const root = new CancellationScope();
    const detached = root.child();
    detached.dispose();
    root.cancel();
    expect(detached.signal.aborted).toBe(false);
  });
});
