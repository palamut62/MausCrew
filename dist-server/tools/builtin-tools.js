import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { spawn } from "node:child_process";
import { WorkspaceBoundary } from "./workspace-boundary.js";
function textArg(args, key) {
    const value = args[key];
    if (typeof value !== "string" || !value.trim())
        throw new Error(`${key} is required`);
    return value;
}
export class FilesystemReadTool {
    name = "filesystem.read";
    async execute(args, context) { return readFile(new WorkspaceBoundary(context.projectRoot).resolve(textArg(args, "path")), "utf8"); }
}
export class FilesystemWriteTool {
    name = "filesystem.write";
    async execute(args, context) { const path = new WorkspaceBoundary(context.projectRoot).resolve(textArg(args, "path"), { write: true }); await mkdir(dirname(path), { recursive: true }); await writeFile(path, textArg(args, "content"), "utf8"); return { path: relative(context.projectRoot, path) }; }
}
export class FilesystemPatchTool {
    name = "filesystem.patch";
    async execute(args, context) { const path = new WorkspaceBoundary(context.projectRoot).resolve(textArg(args, "path")); const search = textArg(args, "search"); const replacement = typeof args.replace === "string" ? args.replace : ""; const current = await readFile(path, "utf8"); const count = current.split(search).length - 1; if (count !== 1)
        throw new Error(`Patch search must match exactly once; matched ${count}`); await writeFile(path, current.replace(search, replacement), "utf8"); return { path: relative(context.projectRoot, path) }; }
}
export class ShellExecuteTool {
    defaults;
    name = "shell.execute";
    constructor(defaults = {}) {
        this.defaults = defaults;
    }
    execute(args, context) {
        const command = textArg(args, "command");
        const boundary = new WorkspaceBoundary(context.projectRoot);
        const cwd = boundary.resolve(typeof args.cwd === "string" ? args.cwd : ".");
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : this.defaults.timeoutMs ?? 30_000;
        const maxOutputBytes = typeof args.maxOutputBytes === "number" ? args.maxOutputBytes : this.defaults.maxOutputBytes ?? 256_000;
        if (timeoutMs < 1 || timeoutMs > 600_000 || maxOutputBytes < 1 || maxOutputBytes > 5_000_000)
            throw new Error("Shell limits are outside the allowed range");
        return new Promise((resolvePromise, reject) => {
            const child = spawn(command, { cwd, shell: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
            let stdout = Buffer.alloc(0);
            let stderr = Buffer.alloc(0);
            let settled = false;
            let timedOut = false;
            const append = (current, chunk) => Buffer.concat([current, chunk]).subarray(0, maxOutputBytes);
            child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
            child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
            const terminate = () => { if (child.pid && process.platform === "win32")
                spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
            else
                child.kill("SIGKILL"); };
            const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutMs);
            const onAbort = () => terminate();
            context.cancellation?.signal.addEventListener("abort", onAbort, { once: true });
            child.on("error", (error) => { if (settled)
                return; settled = true; clearTimeout(timer); reject(error); });
            child.on("close", async (code) => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                context.cancellation?.signal.removeEventListener("abort", onAbort);
                const cancelled = context.cancellation?.signal.aborted ?? false;
                const truncated = stdout.length >= maxOutputBytes || stderr.length >= maxOutputBytes;
                let artifact;
                if (truncated) {
                    const artifactPath = boundary.resolve(`.mauscrew/artifacts/tool-${Date.now()}.log`, { write: true });
                    await mkdir(dirname(artifactPath), { recursive: true });
                    await writeFile(artifactPath, Buffer.concat([stdout, Buffer.from("\n--- stderr ---\n"), stderr]));
                    artifact = relative(context.projectRoot, artifactPath);
                }
                const result = { code, stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), truncated, ...(artifact ? { artifact } : {}) };
                if (cancelled)
                    reject(new Error("Tool execution cancelled"));
                else if (timedOut)
                    reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
                else if (code !== 0)
                    reject(Object.assign(new Error(`Command exited with code ${code}`), { result }));
                else
                    resolvePromise(result);
            });
        });
    }
}
class FixedShellTool {
    name;
    command;
    shell;
    constructor(name, command, shell = new ShellExecuteTool()) {
        this.name = name;
        this.command = command;
        this.shell = shell;
    }
    execute(args, context) { return this.shell.execute({ command: this.command(args), ...(args.cwd ? { cwd: args.cwd } : {}) }, context); }
}
export function builtinTools() {
    const shell = new ShellExecuteTool();
    return [new FilesystemReadTool(), new FilesystemWriteTool(), new FilesystemPatchTool(), shell,
        new FixedShellTool("git.status", () => "git status --short", shell), new FixedShellTool("git.diff", () => "git diff --", shell),
        new FixedShellTool("git.commit", (args) => `git commit -m ${JSON.stringify(textArg(args, "message"))}`, shell),
        new FixedShellTool("search.files", (args) => `rg --files ${args.pattern ? `-g ${JSON.stringify(String(args.pattern))}` : ""}`, shell),
        new FixedShellTool("search.code", (args) => `rg -- ${JSON.stringify(textArg(args, "query"))}`, shell),
        new FixedShellTool("test.run", (args) => typeof args.command === "string" ? args.command : "pnpm test", shell),
        new FixedShellTool("todo.read", () => "if exist TODO.md (type TODO.md) else (exit /b 0)", shell),
        new FixedShellTool("todo.write", (args) => `node -e ${JSON.stringify(`require('fs').writeFileSync('TODO.md',${JSON.stringify(textArg(args, "content"))})`)}`, shell),
    ];
}
