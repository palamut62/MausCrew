import { containerComputerAction, containerComputerScreenshot, containerComputerStatus, } from "../../container-computer.js";
function normalized(status) {
    return {
        provider: "local-vm",
        configured: Boolean(status.runtime && status.daemonUp && status.image),
        state: status.container,
        ready: status.ready,
        persistent: status.persistence === "durable",
        isolated: status.network === "loopback" && status.security === "hardened",
        instanceId: status.container === "missing" ? undefined : "mauscrew-cua",
        ...(status.problem ? { problem: status.problem } : {}),
    };
}
export const LocalVmComputerProvider = {
    id: "local-vm",
    async status() {
        return normalized(await containerComputerStatus());
    },
    async start() {
        const before = await containerComputerStatus();
        if (before.container === "running")
            return normalized(before);
        if (!before.image)
            throw Object.assign(new Error("Prepare the Local VM image before starting it"), { status: 409 });
        return normalized(await containerComputerAction(before.container === "stopped" ? "start" : "run"));
    },
    async stop() {
        const before = await containerComputerStatus();
        if (before.container === "missing" || before.container === "stopped")
            return normalized(before);
        return normalized(await containerComputerAction("stop"));
    },
    async reset() {
        const before = await containerComputerStatus();
        if (!before.image)
            throw Object.assign(new Error("Prepare the Local VM image before resetting it"), { status: 409 });
        if (before.container !== "missing")
            await containerComputerAction("remove");
        return normalized(await containerComputerAction("run"));
    },
    async destroy() {
        const before = await containerComputerStatus();
        if (before.container === "missing")
            return normalized(before);
        return normalized(await containerComputerAction("remove"));
    },
    async getScreen() {
        const dataUrl = await containerComputerScreenshot();
        const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(dataUrl);
        if (!match)
            throw Object.assign(new Error("The Local VM returned an invalid screenshot"), { status: 502 });
        return { data: match[2], mime: match[1] };
    },
    async execute(_scope, _command) {
        throw Object.assign(new Error("Direct shell execution is exposed only through the Local VM's governed Cua MCP tools"), { status: 409 });
    },
};
