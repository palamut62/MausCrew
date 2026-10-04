import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { createAcpDriver, type AcpSupport } from "./core.ts";

const support: AcpSupport = {
  driverKind: "gooseAgent",
  displayName: "Goose",
  models: { default: "auto", options: [{ id: "auto", label: "Goose configured model" }], extensible: true },
  defaultCli: "goose",
  nativeSource: "goose.acp",
  loginNote: "Goose has no configured model provider - run `goose configure` first",
  install: { docsUrl: "https://block.github.io/goose/docs/getting-started/installation", signInCommand: "goose configure" },
  spawnArgs: () => ["acp"],
  credentialEnv: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "DATABRICKS_HOST", "DATABRICKS_TOKEN"],
  pickAuthMethod: () => null,
  authFailure: "continue",
  isAuthenticated: (env) => Boolean(env.GOOSE_PROVIDER) || existsSync(join(homedir(), ".config", "goose", "config.yaml")),
  async configureSession({ request, sessionId, turn }) {
    if (turn.model && turn.model !== "auto") await request("session/set_model", { sessionId, modelId: turn.model });
  },
  buildPromptText: (turn) => turn.system ? `${turn.system}\n\n${turn.text}` : turn.text,
};

export const GooseAgentDriver = createAcpDriver(support);
