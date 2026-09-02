import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TelegramInbox } from "./telegram-inbox.ts";
import type { AcceptedUpdate } from "./telegram-updates.ts";

const dirs: string[] = [];
function tempFile() {
  const dir = mkdtempSync(join(tmpdir(), "mauscrew-telegram-"));
  dirs.push(dir);
  return join(dir, "telegram-inbox.json");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ok = (result: unknown) =>
  new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { "content-type": "application/json" } });

/** Runs the poller for exactly as many batches as `batches` supplies, then
 * stops it — the loop is infinite by design. */
async function drain(
  batches: unknown[][],
  { file = tempFile(), settings = { token: "t", chatId: "12345", enabled: true } } = {} as {
    file?: string;
    settings?: { token: string; chatId: string; enabled: boolean; allowedUserIds?: number[] };
  },
) {
  const seen: AcceptedUpdate[] = [];
  const bodies: Array<Record<string, unknown>> = [];
  let index = 0;
  let done: () => void;
  const finished = new Promise<void>((resolve) => (done = resolve));

  const inbox = new TelegramInbox({
    file,
    settings: () => settings,
    onUpdate: (update) => {
      seen.push(update);
    },
    fetcher: (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      const batch = batches[index++];
      if (!batch) {
        done();
        // Park: the loop is stopped from the outside once the batches run out.
        return new Promise<Response>(() => {});
      }
      return ok(batch);
    }) as unknown as typeof fetch,
  });

  inbox.start();
  await finished;
  await inbox.stop();
  return { seen, bodies, inbox, file };
}

const message = (updateId: number, messageId: number, text = "do the thing") => ({
  update_id: updateId,
  message: { message_id: messageId, text, date: 1_700_000_000, chat: { id: 12345 }, from: { id: 42 } },
});

describe("telegram inbox", () => {
  it("hands accepted messages on and acknowledges past the whole batch", async () => {
    const { seen, bodies, file } = await drain([[message(10, 100), message(11, 101)]]);
    expect(seen.map((update) => update.kind === "message" && update.text)).toEqual(["do the thing", "do the thing"]);
    // First poll starts from the stored offset (0), the next resumes past the
    // batch — which is what stops Telegram resending it.
    expect(bodies[0]).toMatchObject({ offset: 0, timeout: 25 });
    expect(bodies[1]).toMatchObject({ offset: 12 });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ offset: 12, chatId: "12345" });
  });

  it("resumes from the saved offset after a restart", async () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ offset: 500, chatId: "12345" }));
    // The whole point: the same message is not delivered twice across a
    // restart, so it cannot become a second task.
    const { bodies } = await drain([[]], { file });
    expect(bodies[0]).toMatchObject({ offset: 500 });
  });

  it("drops a cursor that belongs to another chat", async () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ offset: 500, chatId: "99999" }));
    const { bodies } = await drain([[]], { file });
    expect(bodies[0]).toMatchObject({ offset: 0 });
  });

  it("acknowledges updates it refuses, so they cannot block the queue", async () => {
    const foreign = { update_id: 20, message: { message_id: 1, text: "hi", chat: { id: 777 }, from: { id: 9 } } };
    const { seen, bodies } = await drain([[foreign]]);
    expect(seen).toEqual([]);
    expect(bodies[1]).toMatchObject({ offset: 21 });
  });

  it("keeps polling after one message throws", async () => {
    const file = tempFile();
    let calls = 0;
    let done: () => void;
    const finished = new Promise<void>((resolve) => (done = resolve));
    const inbox = new TelegramInbox({
      file,
      settings: () => ({ token: "t", chatId: "12345", enabled: true }),
      onUpdate: () => {
        calls += 1;
        if (calls === 1) throw new Error("router blew up");
      },
      fetcher: (async () => {
        if (calls >= 2) {
          done();
          return new Promise<Response>(() => {});
        }
        return ok([message(30 + calls, 200 + calls)]);
      }) as unknown as typeof fetch,
    });
    inbox.start();
    await finished;
    await inbox.stop();
    expect(calls).toBe(2);
  });

  it("reports a bad token instead of dying, and clears it on recovery", async () => {
    const problems: Array<string | null> = [];
    let attempt = 0;
    let done: () => void;
    const finished = new Promise<void>((resolve) => (done = resolve));
    const inbox = new TelegramInbox({
      file: tempFile(),
      settings: () => ({ token: "bad", chatId: "12345", enabled: true }),
      onUpdate: () => {},
      onProblem: (problem) => {
        problems.push(problem);
        if (problems.length >= 2) done();
      },
      fetcher: (async () => {
        attempt += 1;
        if (attempt === 1) {
          return new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 });
        }
        return ok([]);
      }) as unknown as typeof fetch,
    });
    inbox.start();
    await finished;
    await inbox.stop();
    expect(problems[0]).toContain("Unauthorized");
    expect(problems[1]).toBeNull();
  }, 30_000);

  it("stays idle while Telegram is unconfigured", async () => {
    const fetcher = vi.fn();
    const inbox = new TelegramInbox({
      file: tempFile(),
      settings: () => ({ token: "", chatId: "", enabled: true }),
      onUpdate: () => {},
      fetcher: fetcher as unknown as typeof fetch,
    });
    inbox.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await inbox.stop();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
