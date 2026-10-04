import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.js";
export class ClaudeCodeAgentProvider extends ProviderInstanceAgentAdapter {
    constructor(instance) { super(instance, ["claudeAgent"]); }
}
