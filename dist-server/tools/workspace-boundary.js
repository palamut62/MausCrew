import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
export class WorkspaceBoundary {
    root;
    constructor(root) { this.root = realpathSync(resolve(root)); }
    resolve(path, options = {}) {
        if (!path || path.includes("\0"))
            throw new Error("Workspace path is invalid");
        const candidate = resolve(this.root, path);
        this.#assertInside(candidate);
        const existing = existsSync(candidate) ? candidate : this.#nearestExisting(dirname(candidate));
        const real = realpathSync(existing);
        this.#assertInside(real);
        if (!options.write && !existsSync(candidate))
            throw new Error(`Workspace path does not exist: ${path}`);
        return candidate;
    }
    #nearestExisting(path) {
        let cursor = path;
        while (!existsSync(cursor)) {
            const parent = dirname(cursor);
            if (parent === cursor)
                throw new Error("Workspace parent does not exist");
            cursor = parent;
        }
        return cursor;
    }
    #assertInside(path) {
        const rel = relative(this.root, path);
        if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)))
            return;
        throw new Error("Path escapes the project workspace");
    }
}
