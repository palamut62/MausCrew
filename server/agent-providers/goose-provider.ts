import type { ProviderInstance } from "../contracts.ts";
import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.ts";
export class GooseAgentProvider extends ProviderInstanceAgentAdapter { constructor(instance: ProviderInstance) { super(instance, ["gooseAgent"]); } }
