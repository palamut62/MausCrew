import { AntigravityDriver } from "./antigravity.js";
import { BoxAgentDriver } from "./boxagent.js";
import { ClaudeDriver } from "./claude.js";
import { CodexDriver } from "./codex.js";
import { GrokDriver } from "./grok.js";
import { GrokAgentDriver } from "./acp/grok.js";
import { GeminiAgentDriver } from "./acp/gemini.js";
import { KimiAgentDriver } from "./acp/kimi.js";
import { DroidAgentDriver } from "./acp/droid.js";
import { OpenCodeGoDriver } from "./acp/opencode-go.js";
import { GooseAgentDriver } from "./acp/goose.js";
import { DeepSeekHarnessDriver } from "./deepseek-harness.js";
import { AguiDriver } from "./agui.js";
export const BUILT_IN_DRIVERS = [
    GrokDriver,
    GrokAgentDriver,
    GeminiAgentDriver,
    KimiAgentDriver,
    DroidAgentDriver,
    OpenCodeGoDriver,
    GooseAgentDriver,
    ClaudeDriver,
    CodexDriver,
    AntigravityDriver,
    BoxAgentDriver,
    AguiDriver,
    // appended last so the existing engine ordering in the UI is unchanged
    DeepSeekHarnessDriver,
];
