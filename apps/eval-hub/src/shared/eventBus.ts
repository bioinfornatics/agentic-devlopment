/**
 * EventBus — pub/sub bridge between pull-based AsyncGenerators and push
 * consumers (SSE, TUI, CLI progress).
 */
import { EventEmitter } from "node:events";
import type { DomainEvent } from "./events.js";
import type { IEventSink } from "../domains/execution/ports.js";

export class EventBus implements IEventSink {
  private readonly emitter = new EventEmitter();

  /** Publish one domain event to all subscribers. */
  emit(event: DomainEvent): void {
    this.emitter.emit("event", event);
  }

  /** Subscribe to all domain events. */
  onEvent(listener: (event: DomainEvent) => void): this {
    this.emitter.on("event", listener);
    return this;
  }

  removeListener(name: string, listener: (...args: unknown[]) => void): this {
    this.emitter.removeListener(name, listener);
    return this;
  }

  on(name: string, listener: (...args: unknown[]) => void): this {
    this.emitter.on(name, listener);
    return this;
  }
}

/** Null sink — discards all events. Default when no sink is injected. */
export const NULL_SINK: IEventSink = { emit: () => {} };
