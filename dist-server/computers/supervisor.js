export class ComputerSupervisor {
    providers = new Map();
    constructor(providers) {
        for (const provider of providers) {
            if (this.providers.has(provider.id))
                throw new Error(`duplicate computer provider: ${provider.id}`);
            this.providers.set(provider.id, provider);
        }
    }
    provider(id) {
        const provider = this.providers.get(id);
        if (!provider)
            throw Object.assign(new Error(`computer provider is unavailable: ${id}`), { status: 409 });
        return provider;
    }
    list() {
        return [...this.providers.keys()];
    }
    status(id, scope) {
        return this.provider(id).status(scope);
    }
    start(id, scope) {
        return this.provider(id).start(scope);
    }
    stop(id, scope) {
        return this.provider(id).stop(scope);
    }
    reset(id, scope) {
        return this.provider(id).reset(scope);
    }
    destroy(id, scope) {
        return this.provider(id).destroy(scope);
    }
}
