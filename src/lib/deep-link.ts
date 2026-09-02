// mauscrew://bot/add?name=..&title=..&description=.. — a website's bot card
// links here the same way it would link grokbot://app/v1/bot-template?id=..
// for GrokBot; the main process (electron/main.mjs) parses the URL and
// forwards the fields over IPC. Absent in the browser / when no link has
// fired yet — callers render nothing then.
import { useEffect, useState } from "react";

export interface DeepLinkBot {
  name: string;
  title: string;
  description: string;
}

export function useDeepLinkBotImport(): [DeepLinkBot | null, () => void] {
  const [bot, setBot] = useState<DeepLinkBot | null>(null);
  useEffect(() => window.mauscrew?.onDeepLinkBotAdd?.(setBot), []);
  return [bot, () => setBot(null)];
}
