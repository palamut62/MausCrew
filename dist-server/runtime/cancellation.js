export class CancellationScope {
    #controller = new AbortController();
    #children = new Set();
    #parent;
    constructor(parent) {
        this.#parent = parent;
        if (parent)
            parent.#children.add(this);
        if (parent?.signal.aborted)
            this.cancel(parent.signal.reason);
    }
    get signal() {
        return this.#controller.signal;
    }
    child() {
        return new CancellationScope(this);
    }
    cancel(reason = new Error("Cancelled")) {
        if (this.signal.aborted)
            return;
        this.#controller.abort(reason);
        for (const child of [...this.#children])
            child.cancel(reason);
        this.#children.clear();
        if (this.#parent)
            this.#parent.#children.delete(this);
    }
    dispose() {
        if (this.#parent)
            this.#parent.#children.delete(this);
        this.#children.clear();
    }
}
