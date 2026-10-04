export class CancellationScope {
  readonly #controller = new AbortController();
  readonly #children = new Set<CancellationScope>();
  readonly #parent?: CancellationScope;

  constructor(parent?: CancellationScope) {
    this.#parent = parent;
    if (parent) parent.#children.add(this);
    if (parent?.signal.aborted) this.cancel(parent.signal.reason);
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  child(): CancellationScope {
    return new CancellationScope(this);
  }

  cancel(reason: unknown = new Error("Cancelled")): void {
    if (this.signal.aborted) return;
    this.#controller.abort(reason);
    for (const child of [...this.#children]) child.cancel(reason);
    this.#children.clear();
    if (this.#parent) this.#parent.#children.delete(this);
  }

  dispose(): void {
    if (this.#parent) this.#parent.#children.delete(this);
    this.#children.clear();
  }
}
