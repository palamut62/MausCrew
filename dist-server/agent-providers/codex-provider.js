import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.js";
export class CodexAgentProvider extends ProviderInstanceAgentAdapter {
    constructor(instance) { super(instance, ["codex"]); }
}
