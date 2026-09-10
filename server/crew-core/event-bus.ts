import type { CrewEvent, CrewEventType } from "./events.ts";

export type CrewEventListener = (event: CrewEvent) => void | Promise<void>;
export type EventBusOverflowPolicy = "reject-new" | "drop-oldest";

interface Subscriber {
  id: string;
  types?: ReadonlySet<CrewEventType>;
  listener: CrewEventListener;
  queue: CrewEvent[];
  draining: boolean;
}

export interface EventBusOptions {
  maxQueueSize?: number;
  overflowPolicy?: EventBusOverflowPolicy;
  onListenerError?: (error: unknown, event: CrewEvent, subscriberId: string) => void;
}

export class CrewEventBus {
  readonly maxQueueSize: number;
  readonly overflowPolicy: EventBusOverflowPolicy;
  readonly #subscribers = new Map<string, Subscriber>();
  readonly #onListenerError: NonNullable<EventBusOptions["onListenerError"]>;

  constructor(options: EventBusOptions = {}) {
    this.maxQueueSize = options.maxQueueSize ?? 256;
    if (!Number.isInteger(this.maxQueueSize) || this.maxQueueSize < 1) throw new Error("Event bus maxQueueSize must be at least 1");
    this.overflowPolicy = options.overflowPolicy ?? "reject-new";
    this.#onListenerError = options.onListenerError ?? (() => undefined);
  }

  subscribe(id: string, listener: CrewEventListener, types?: Iterable<CrewEventType>): () => void {
    if (!id.trim()) throw new Error("Subscriber id is required");
    if (this.#subscribers.has(id)) throw new Error(`Duplicate event subscriber: ${id}`);
    this.#subscribers.set(id, { id, listener, types: types ? new Set(types) : undefined, queue: [], draining: false });
    return () => this.#subscribers.delete(id);
  }

  publish(event: CrewEvent): string[] {
    const overflowed: string[] = [];
    for (const subscriber of this.#subscribers.values()) {
      if (subscriber.types && !subscriber.types.has(event.type)) continue;
      if (subscriber.queue.length >= this.maxQueueSize) {
        overflowed.push(subscriber.id);
        if (this.overflowPolicy === "reject-new") continue;
        subscriber.queue.shift();
      }
      subscriber.queue.push(event);
      this.#schedule(subscriber);
    }
    return overflowed;
  }

  queueLength(subscriberId: string): number {
    return this.#subscribers.get(subscriberId)?.queue.length ?? 0;
  }

  #schedule(subscriber: Subscriber): void {
    if (subscriber.draining) return;
    subscriber.draining = true;
    queueMicrotask(() => void this.#drain(subscriber));
  }

  async #drain(subscriber: Subscriber): Promise<void> {
    try {
      while (this.#subscribers.get(subscriber.id) === subscriber) {
        const event = subscriber.queue.shift();
        if (!event) break;
        try {
          await subscriber.listener(event);
        } catch (error) {
          this.#onListenerError(error, event, subscriber.id);
        }
      }
    } finally {
      subscriber.draining = false;
      if (subscriber.queue.length && this.#subscribers.get(subscriber.id) === subscriber) this.#schedule(subscriber);
    }
  }
}
