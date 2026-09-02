import { useEffect, useState } from "react";
import { ArrowSquareOut, Check, PaperPlaneTilt, SignOut } from "@phosphor-icons/react";

import { api, useStore, type ConfigStatus } from "@/state/store";
import { Spin } from "./Spin";

export function TelegramSettings() {
  const { state, dispatch } = useStore();
  const status = state.config?.telegram;
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [working, setWorking] = useState<"save" | "discover" | "test" | "disconnect" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!status) return;
    queueMicrotask(() => {
      setChatId(status.chatId);
      setEnabled(status.enabled);
    });
  }, [status]);

  if (!status) return null;

  const finish = (config: ConfigStatus, text: string) => {
    dispatch({ type: "configStatus", config });
    setToken("");
    setMessage(text);
  };

  const save = async () => {
    setWorking("save");
    setError("");
    setMessage("");
    try {
      const telegram: Record<string, unknown> = { chatId: chatId.trim(), enabled };
      if (token.trim()) telegram.botToken = token.trim();
      const config = await api("/api/config", { method: "PUT", body: JSON.stringify({ telegram }) }) as ConfigStatus;
      finish(config, "Telegram settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWorking(null);
    }
  };

  const discover = async () => {
    setWorking("discover");
    setError("");
    setMessage("");
    try {
      const result = await api("/api/telegram/discover-chat", { method: "POST", body: "{}" }) as {
        chat: { id: string; label: string };
        config: ConfigStatus;
      };
      setChatId(result.chat.id);
      finish(result.config, `Connected to ${result.chat.label}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWorking(null);
    }
  };

  const test = async () => {
    setWorking("test");
    setError("");
    setMessage("");
    try {
      await api("/api/telegram/test", { method: "POST", body: "{}" });
      setMessage("Test message sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWorking(null);
    }
  };

  const disconnect = async () => {
    setWorking("disconnect");
    setError("");
    setMessage("");
    try {
      const config = await api("/api/config", {
        method: "PUT",
        body: JSON.stringify({ telegram: { botToken: "", chatId: "", enabled: false } }),
      }) as ConfigStatus;
      setChatId("");
      finish(config, "Telegram disconnected.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[13px] text-ink-secondary">
          <span className={`size-1.5 rounded-full ${status.configured ? "bg-success" : "bg-raised-hover"}`} />
          <span>Bot token</span>
          {status.configured && (
            <span className="text-[11px] text-success">
              Connected{status.botUsername ? ` · @${status.botUsername}` : ""}
            </span>
          )}
        </div>
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={status.configured ? "••••••••  (paste to replace)" : "Paste the token from @BotFather"}
          aria-label="Telegram bot token"
          autoComplete="off"
          className="w-full rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="telegram-chat-id" className="text-[13px] text-ink-secondary">Destination chat</label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="telegram-chat-id"
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            placeholder="Send /start, then detect the chat"
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:outline-none"
          />
          <button
            onClick={() => void discover()}
            disabled={working !== null || !status.configured}
            className="rounded-lg border border-hairline px-3 text-[12.5px] text-ink hover:bg-raised disabled:opacity-40"
          >
            {working === "discover" ? <Spin size={13} weight="fill" /> : "Detect chat"}
          </button>
        </div>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-lg bg-inset px-3 py-2.5 text-[13px] text-ink">
        Send each bot&apos;s full completion report, question, and approval request with its own name, role, and colour
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4 accent-[var(--accent)]" />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void save()}
          disabled={working !== null || (!status.configured && !token.trim())}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-app disabled:opacity-40"
        >
          {working === "save" ? <Spin size={13} weight="fill" /> : <Check size={13} weight="bold" />} Save
        </button>
        <button
          onClick={() => void test()}
          disabled={working !== null || !status.configured || !status.chatId}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-hairline px-3.5 text-[13px] text-ink hover:bg-raised disabled:opacity-40"
        >
          {working === "test" ? <Spin size={13} weight="fill" /> : <PaperPlaneTilt size={14} weight="bold" />} Send test
        </button>
        {status.configured && (
          <button
            onClick={() => void disconnect()}
            disabled={working !== null}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] text-danger hover:bg-danger/10 disabled:opacity-40"
          >
            {working === "disconnect" ? <Spin size={13} weight="fill" /> : <SignOut size={14} weight="bold" />} Disconnect
          </button>
        )}
      </div>

      <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline">
        Create a Telegram bot with @BotFather <ArrowSquareOut size={12} weight="bold" />
      </a>
      {message && <div className="text-[12px] text-success">{message}</div>}
      {error && <div role="alert" className="text-[12px] text-danger">{error}</div>}
    </div>
  );
}
