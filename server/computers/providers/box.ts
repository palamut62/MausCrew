import * as box from "../../box.ts";
import type { AppConfig } from "../../config.ts";
import type { ComputerProvider, ComputerScope, ComputerStatus } from "../provider.ts";

const READY = new Set(["idle", "ready", "running"]);

export function BoxComputerProvider(config: () => AppConfig): ComputerProvider {
  const normalized = async (scope: ComputerScope): Promise<ComputerStatus> => {
    const status = await box.boxStatus(config(), scope.botId);
    return {
      provider: "box",
      configured: status.configured,
      state: status.box?.state ?? (status.configured ? "missing" : "unconfigured"),
      ready: Boolean(status.box && READY.has(status.box.state)),
      persistent: true,
      isolated: true,
      instanceId: status.box?.boxId,
      ...(!status.configured ? { problem: "Box API key is not configured" } : {}),
    };
  };

  return {
    id: "box",
    status: normalized,
    async start(scope) {
      await box.provisionBox(config(), scope.botId, scope.botName);
      return normalized(scope);
    },
    async stop(scope) {
      await box.sleepBox(config(), scope.botId);
      return normalized(scope);
    },
    async reset(scope) {
      await box.destroyBox(config(), scope.botId);
      await box.provisionBox(config(), scope.botId, scope.botName);
      return normalized(scope);
    },
    async destroy(scope) {
      await box.destroyBox(config(), scope.botId);
      return normalized(scope);
    },
    async getScreen(scope) {
      const frame = await box.screenshotBox(config(), scope.botId);
      return { data: frame.png, mime: frame.format === "jpeg" ? "image/jpeg" : "image/png" };
    },
    execute(scope, command) {
      return box.execOnBox(config(), scope.botId, command);
    },
  };
}
