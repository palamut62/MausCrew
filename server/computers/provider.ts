export type ComputerProviderId = "local-vm" | "box";

export type ComputerScope = {
  botId: string;
  botName: string;
};

export type ComputerStatus = {
  provider: ComputerProviderId;
  configured: boolean;
  state: string;
  ready: boolean;
  persistent: boolean;
  isolated: boolean;
  instanceId?: string;
  problem?: string;
};

export type ComputerFrame = {
  data: string;
  mime: "image/png" | "image/jpeg";
};

export type ComputerCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

/** Provider-neutral computer lifecycle used by the harness and settings UI.
 * Providers may retain richer native helpers for their MCP transports, but
 * lifecycle calls no longer need to know whether the machine is a container
 * or an ascii.dev Box. */
export interface ComputerProvider {
  readonly id: ComputerProviderId;
  status(scope: ComputerScope): Promise<ComputerStatus>;
  start(scope: ComputerScope): Promise<ComputerStatus>;
  stop(scope: ComputerScope): Promise<ComputerStatus>;
  reset(scope: ComputerScope): Promise<ComputerStatus>;
  destroy(scope: ComputerScope): Promise<ComputerStatus>;
  getScreen(scope: ComputerScope): Promise<ComputerFrame>;
  execute(scope: ComputerScope, command: string): Promise<ComputerCommandResult>;
}
