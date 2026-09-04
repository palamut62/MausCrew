import { describe, expect, it } from "vitest";

import type { Bot, Message, OptionCardData } from "@/state/store";
import { botWaiting, collectDecisions, currentActivity, orderDecisions, relativeTime, taskTitle } from "./mobile";

let seq = 0;
const nextId = () => `m${++seq}`;

function card(over: Partial<OptionCardData> = {}): OptionCardData {
  return { title: "", subtitle: "", options: [], ...over };
}

function message(over: Partial<Message>): Message {
  return { id: nextId(), role: "bot", kind: "text", at: 1_000, ...over };
}

function bot(over: Partial<Bot> = {}): Bot {
  return {
    id: "b1",
    threadId: "t1",
    name: "Kaya",
    title: "Araştırmacı",
    description: "",
    notifications: false,
    color: "red",
    unread: false,
    messages: [],
    modelSelection: {},
    ...over,
  } as unknown as Bot;
}

const approvalCard = card({
  title: "Bash",
  subtitle: "rm -rf build",
  options: ["Allow", "Deny"],
  requestId: "r1",
  tool: "Bash",
  held: "auto mode paused",
});

describe("mobil karar kuyruğu", () => {
  it("bekleyen bir izin kartını karara çevirir", () => {
    const owner = bot({ messages: [message({ kind: "options", card: approvalCard })] });
    const [decision, ...rest] = collectDecisions([owner]);
    expect(rest).toHaveLength(0);
    expect(decision.kind).toBe("approval");
    expect(decision.tool).toBe("Bash");
    expect(decision.detail).toBe("rm -rf build");
    expect(decision.held).toBe("auto mode paused");
    expect(decision.title).toBe("Komut çalıştırmak istiyor");
  });

  it("yanıtlanmış ya da kapatılmış kartları saymaz", () => {
    const answered = bot({ messages: [message({ kind: "options", card: card({ ...approvalCard, answered: "Allow" }) })] });
    const dismissed = bot({ id: "b2", messages: [message({ kind: "options", card: card({ ...approvalCard, dismissed: true }) })] });
    expect(collectDecisions([answered, dismissed])).toHaveLength(0);
  });

  it("aracı olmayan kartı kendi seçenekleriyle bir soru sayar", () => {
    const owner = bot({
      messages: [message({ kind: "options", card: card({ title: "Hangi dilde yazayım?", options: ["Türkçe", "İngilizce"], requestId: "r2" }) })],
    });
    const [decision] = collectDecisions([owner]);
    expect(decision.kind).toBe("question");
    expect(decision.title).toBe("Hangi dilde yazayım?");
    expect(decision.options).toEqual(["Türkçe", "İngilizce"]);
  });

  it("kararları bütün botlardan toplar", () => {
    const first = bot({ messages: [message({ kind: "options", card: approvalCard })] });
    const second = bot({ id: "b2", name: "Efe", messages: [message({ kind: "options", card: card({ ...approvalCard, requestId: "r9" }) })] });
    expect(collectDecisions([first, second]).map((item) => item.id)).toEqual(["b1:r1", "b2:r9"]);
  });
});

describe("erteleme sırası", () => {
  const queue = ["a", "b", "c"].map((id) => ({ id }) as ReturnType<typeof collectDecisions>[number]);

  it("ertelenen kararı kuyruğun sonuna atar", () => {
    expect(orderDecisions(queue, ["a"]).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("iki erteleme kendi aralarında sırasını korur", () => {
    expect(orderDecisions(queue, ["b", "a"]).map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("artık var olmayan bir erteleme sırayı bozmaz", () => {
    expect(orderDecisions(queue, ["yok"]).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

describe("bot durumu", () => {
  it("bekleyen kartı olan bot seni bekliyor sayılır", () => {
    expect(botWaiting(bot({ messages: [message({ kind: "options", card: approvalCard })] }))).toBe(true);
    expect(botWaiting(bot({ messages: [message({ kind: "options", card: card({ ...approvalCard, answered: "Allow" }) })] }))).toBe(false);
  });

  it("görev başlığı önce göreve, sonra ilk kullanıcı mesajına bakar", () => {
    expect(taskTitle(bot({ tasks: [{ threadId: "t1", title: "Fiyatları çıkar" }] as Bot["tasks"] }))).toBe("Fiyatları çıkar");
    expect(taskTitle(bot({ messages: [message({ role: "user", text: "Rakipleri tara" })] }))).toBe("Rakipleri tara");
    expect(taskTitle(bot())).toBe("Henüz görev verilmedi");
  });

  it("şu anki adım son aktivite satırıdır", () => {
    const owner = bot({
      messages: [
        message({ kind: "activity", tool: { name: "Read", spoken: "dosya okunuyor" } }),
        message({ kind: "activity", tool: { name: "Write", spoken: "tabloya yazılıyor" } }),
      ],
    });
    expect(currentActivity(owner)).toBe("tabloya yazılıyor");
    expect(currentActivity(bot())).toBeUndefined();
  });
});

describe("göreli zaman", () => {
  it("dakika, saat ve günü ayırır", () => {
    const now = Date.now();
    expect(relativeTime(now)).toBe("az önce");
    expect(relativeTime(now - 5 * 60_000)).toBe("5 dakika önce");
    expect(relativeTime(now - 3 * 3_600_000)).toBe("3 saat önce");
    expect(relativeTime(now - 48 * 3_600_000)).toBe("2 gün önce");
  });
});
