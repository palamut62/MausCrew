export class ProviderRegistry {
    byId = new Map();
    driversByKind;
    /** Instances whose last turn ended because the CLI refused to authenticate.
     *
     * A driver's own check is a guess made from disk — a credentials file that
     * exists but holds an expired token reads as "signed in" and the picker says
     * ready right up until the turn fails. The turn is the only authority on
     * this, so its verdict is remembered and overlaid on the snapshot until a
     * turn succeeds again. */
    authFailures = new Map();
    constructor(drivers) {
        this.driversByKind = new Map(drivers.map((d) => [d.driverKind, d]));
    }
    /** A turn refused for want of a login. Kept until one succeeds. */
    noteAuthFailure(instanceId, reason) {
        if (this.byId.has(instanceId))
            this.authFailures.set(instanceId, reason.split("\n").filter(Boolean).at(-1) ?? reason);
    }
    /** A turn ran, so whatever the snapshot said about signing in is stale. */
    clearAuthFailure(instanceId) {
        this.authFailures.delete(instanceId);
    }
    async load(configs) {
        for (const [instanceId, entry] of Object.entries(configs)) {
            const driver = this.driversByKind.get(entry.driver);
            if (!driver) {
                this.byId.set(instanceId, {
                    instanceId,
                    shadow: {
                        instanceId,
                        driverKind: entry.driver,
                        displayName: entry.displayName,
                        shadow: true,
                        reason: `unknown driver "${entry.driver}" — kept as configured, unavailable here`,
                    },
                });
                continue;
            }
            try {
                const config = entry.config === undefined ? driver.defaultConfig() : driver.decodeConfig(entry.config);
                const live = await driver.create({
                    instanceId,
                    displayName: entry.displayName ?? driver.metadata.displayName,
                    environment: entry.environment ?? {},
                    enabled: entry.enabled ?? true,
                    config,
                });
                this.byId.set(instanceId, { instanceId, live });
            }
            catch (e) {
                this.byId.set(instanceId, {
                    instanceId,
                    shadow: {
                        instanceId,
                        driverKind: entry.driver,
                        displayName: entry.displayName ?? driver.metadata.displayName,
                        shadow: true,
                        reason: e instanceof Error ? e.message : String(e),
                    },
                });
            }
        }
    }
    get(instanceId) {
        return this.byId.get(instanceId)?.live ?? null;
    }
    entries() {
        return [...this.byId.values()];
    }
    instances() {
        return [...this.byId.values()].flatMap((e) => (e.live ? [e.live] : []));
    }
    /** instance snapshots for the model picker: id, driver, models, health */
    async describe() {
        return Promise.all(this.entries().map(async (entry) => {
            if (entry.shadow) {
                return {
                    instanceId: entry.instanceId,
                    driverKind: entry.shadow.driverKind,
                    displayName: entry.shadow.displayName ?? entry.shadow.driverKind,
                    snapshot: { state: "unavailable", reason: entry.shadow.reason },
                    models: { default: "", options: [] },
                    capabilities: { computerMcp: false, agentsMcp: false, routinesMcp: false },
                    // an unknown driver has no driver record, hence no install path
                    install: this.driversByKind.get(entry.shadow.driverKind)?.install,
                };
            }
            const inst = entry.live;
            let snapshot;
            try {
                await inst.refreshModels?.();
                snapshot = await inst.snapshot();
            }
            catch (e) {
                snapshot = { state: "unavailable", reason: e instanceof Error ? e.message : String(e) };
            }
            // The turn's verdict wins over the driver's disk check, never the
            // other way round: a driver that already knows it is signed out is
            // right, and one that thinks it is signed in has been proven wrong.
            const authFailure = this.authFailures.get(inst.instanceId);
            if (authFailure && snapshot.state === "available" && snapshot.authenticated !== false) {
                snapshot = { ...snapshot, authenticated: false, reason: snapshot.reason ?? authFailure };
            }
            return {
                instanceId: inst.instanceId,
                driverKind: inst.driverKind,
                displayName: inst.displayName ?? inst.driverKind,
                snapshot,
                models: inst.models,
                capabilities: {
                    computerMcp: inst.adapter.capabilities.computerMcp === true,
                    agentsMcp: inst.adapter.capabilities.agentsMcp === true,
                    routinesMcp: inst.adapter.capabilities.routinesMcp === true,
                    effortLevels: inst.adapter.capabilities.effortLevels,
                },
                install: this.driversByKind.get(inst.driverKind)?.install,
            };
        }));
    }
    async disposeAll() {
        await Promise.allSettled(this.instances().map((i) => i.dispose()));
        this.byId.clear();
    }
}
