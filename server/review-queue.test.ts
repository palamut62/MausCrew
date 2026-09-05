import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { deliveryOutcome, ReviewQueue } from "./review-queue.ts";

function queued(queue: ReviewQueue) {
  return queue.create({
    title: "Release note",
    content: "Version ready",
    target: "Slack #releases",
    sourceBotId: "writer",
    sourceThreadId: "thread",
  });
}

describe("ReviewQueue", () => {
  it("persists a review through delivery states", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-review-")), "review.json");
    const queue = new ReviewQueue(file);
    const item = queued(queue);
    queue.update(item.id, { status: "sending", deliveryThreadId: "delivery" });
    queue.update(item.id, { status: "sent", result: "Posted" });
    expect(new ReviewQueue(file).get(item.id)).toMatchObject({ status: "sent", result: "Posted" });
  });

  it("fails deliveries a previous run left mid-send", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mauscrew-review-")), "review.json");
    const queue = new ReviewQueue(file);
    const item = queued(queue);
    queue.update(item.id, { status: "sending", deliveryThreadId: "delivery" });

    const restarted = new ReviewQueue(file);
    expect(restarted.recoverStuckDeliveries()).toBe(1);
    expect(restarted.get(item.id)?.status).toBe("unknown");
    // and it survives the sweep as failed rather than reverting on next boot
    expect(new ReviewQueue(file).get(item.id)?.status).toBe("unknown");
    expect(new ReviewQueue(file).recoverStuckDeliveries()).toBe(0);
  });
});

describe("deliveryOutcome", () => {
  it("requires independent confirmation even when the model claims success", () => {
    expect(deliveryOutcome("Mailed it.\nDELIVERY: SENT", true).status).toBe("unknown");
    expect(deliveryOutcome("Posted to #releases.\n**DELIVERY: SENT**", true).status).toBe("unknown");
  });

  it("records a turn that says it could not send as failed", () => {
    const outcome = deliveryOutcome("I have no mail tool.\nDELIVERY: NOT SENT - no Gmail account", true);
    expect(outcome.status).toBe("unknown");
    expect(outcome.result).toContain("no Gmail account");
  });

  it("does not call an unconfirmed turn sent", () => {
    // The old rule read a completed turn as a delivered message, so a bot
    // explaining that it cannot send anything was stamped "sent".
    const outcome = deliveryOutcome("Sorry, I can't reach Slack from here.", true);
    expect(outcome.status).toBe("unknown");
    expect(outcome.result).toContain("Teslim doğrulanmadı");
  });

  it("does not interpret quoted or conflicting delivery verdicts as proof", () => {
    expect(deliveryOutcome("DELIVERY: SENT\nActually it bounced.\nDELIVERY: NOT SENT - bounced", true).status).toBe("unknown");
  });

  it("fails a turn that did not complete, whatever it said", () => {
    expect(deliveryOutcome("DELIVERY: SENT", false).status).toBe("unknown");
    expect(deliveryOutcome("", false).result).toContain("Teslim doğrulanmadı");
  });
});

it("edits only the reviewed revision and locks dispatched drafts", () => {
  const queue = new ReviewQueue(join(mkdtempSync(join(tmpdir(), "review-edit-")), "reviews.json"));
  const item = queued(queue);
  const patch = { title: "New title", target: "New target", content: "New body", revision: 1 };
  expect(queue.edit(item.id, patch)).toMatchObject({ ...patch, revision: 2 });
  expect(() => queue.edit(item.id, patch)).toThrow();
  queue.update(item.id, { status: "sending" });
  expect(() => queue.edit(item.id, { ...patch, revision: 2 })).toThrow();
});
