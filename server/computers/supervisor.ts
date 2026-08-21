import type { ComputerProvider, ComputerProviderId, ComputerScope } from "./provider.ts";

export class ComputerSupervisor {
  private readonly providers = new Map<ComputerProviderId, ComputerProvider>();

  constructor(providers: ComputerProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.id)) throw new Error(`duplicate computer provider: ${provider.id}`);
      this.providers.set(provider.id, provider);
    }
  }

  provider(id: ComputerProviderId): ComputerProvider {
    const provider = this.providers.get(id);
    if (!provider) throw Object.assign(new Error(`computer provider is unavailable: ${id}`), { status: 409 });
    return provider;
  }

  list() {
    return [...this.providers.keys()];
  }

  status(id: ComputerProviderId, scope: ComputerScope) {
    return this.provider(id).status(scope);
  }

  start(id: ComputerProviderId, scope: ComputerScope) {
    return this.provider(id).start(scope);
  }

  stop(id: ComputerProviderId, scope: ComputerScope) {
    return this.provider(id).stop(scope);
  }

  reset(id: ComputerProviderId, scope: ComputerScope) {
    return this.provider(id).reset(scope);
  }

  destroy(id: ComputerProviderId, scope: ComputerScope) {
    return this.provider(id).destroy(scope);
  }
}
