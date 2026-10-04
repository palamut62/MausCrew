import { describe, expect, it } from "vitest";

import { confirmDialog, currentConfirm, subscribeConfirm } from "./confirm";

describe("confirmDialog", () => {
  it("resolves with the user's choice and clears the request", async () => {
    let notified = 0;
    const unsubscribe = subscribeConfirm(() => notified++);
    const answer = confirmDialog({ title: "Delete?" });
    expect(currentConfirm()?.title).toBe("Delete?");
    currentConfirm()!.settle(true);
    await expect(answer).resolves.toBe(true);
    expect(currentConfirm()).toBeNull();
    expect(notified).toBe(2);
    unsubscribe();
  });

  it("cancels a pending request when a new one opens", async () => {
    const first = confirmDialog({ title: "First" });
    const stale = currentConfirm()!;
    const second = confirmDialog({ title: "Second" });
    await expect(first).resolves.toBe(false);
    // the superseded dialog's buttons must not answer the new request
    stale.settle(true);
    expect(currentConfirm()?.title).toBe("Second");
    currentConfirm()!.settle(false);
    await expect(second).resolves.toBe(false);
  });
});
