import type { ProviderInstance } from "../contracts.ts";
import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.ts";
export class ClaudeCodeAgentProvider extends ProviderInstanceAgentAdapter { constructor(instance: ProviderInstance) { super(instance, ["claudeAgent"]); } }
