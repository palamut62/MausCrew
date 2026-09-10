import type { ProviderInstance } from "../contracts.ts";
import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.ts";
export class CodexAgentProvider extends ProviderInstanceAgentAdapter { constructor(instance: ProviderInstance) { super(instance, ["codex"]); } }
