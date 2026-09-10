import { ProviderInstanceAgentAdapter } from "./provider-instance-adapter.js";
export class GooseAgentProvider extends ProviderInstanceAgentAdapter {
    constructor(instance) { super(instance, ["gooseAgent"]); }
}
