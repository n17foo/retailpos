import { SyncEvent, SyncEventType } from './SyncEventTypes';
import { localApiConfig } from '../LocalApiConfig';
import { LoggerFactory } from '../../logger/LoggerFactory';

type SyncEventHandler = (event: SyncEvent) => void | Promise<void>;

/**
 * In-process event bus for multi-register sync events.
 *
 * - **Server mode**: events are emitted locally and broadcast to connected clients
 *   via the polling endpoint.
 * - **Client mode**: events received from the server are emitted locally so the
 *   UI and services can react.
 * - **Standalone mode**: events are emitted locally only (no networking).
 */
export class SyncEventBus {
  private static instance: SyncEventBus;
  private logger = LoggerFactory.getInstance().createLogger('SyncEventBus');
  private handlers = new Map<SyncEventType, Set<SyncEventHandler>>();
  private globalHandlers = new Set<SyncEventHandler>();
  /** Recent events kept for client polling (server mode only) */
  private recentEvents: SyncEvent[] = [];
  private readonly MAX_RECENT = 500;

  private constructor() {}

  static getInstance(): SyncEventBus {
    if (!SyncEventBus.instance) {
      SyncEventBus.instance = new SyncEventBus();
    }
    return SyncEventBus.instance;
  }

  /** Emit a sync event */
  emit(type: SyncEventType, payload: unknown): SyncEvent {
    const event: SyncEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      registerId: localApiConfig.current.registerId,
      registerName: localApiConfig.current.registerName,
      payload,
      timestamp: Date.now(),
    };

    // Store for polling
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.MAX_RECENT) {
      this.recentEvents = this.recentEvents.slice(-this.MAX_RECENT);
    }

    // Dispatch to handlers
    this.dispatch(event);

    return event;
  }

  /** Dispatch an externally received event (from server polling) */
  receive(event: SyncEvent): void {
    // Don't re-dispatch our own events
    if (event.registerId === localApiConfig.current.registerId) return;
    this.dispatch(event);
  }

  /** Subscribe to a specific event type */
  on(type: SyncEventType, handler: SyncEventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Subscribe to all event types */
  onAny(handler: SyncEventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /** Get events since a given timestamp (for server polling endpoint) */
  getEventsSince(sinceTimestamp: number): SyncEvent[] {
    return this.recentEvents.filter(e => e.timestamp > sinceTimestamp);
  }

  /** Clear all stored events */
  clear(): void {
    this.recentEvents = [];
  }

  private dispatch(event: SyncEvent): void {
    // Type-specific handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (error) {
          this.logger.error(
            { message: `Error in sync event handler for ${event.type}` },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    }

    // Global handlers
    for (const handler of this.globalHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error({ message: `Error in global sync event handler` }, error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}

export const syncEventBus = SyncEventBus.getInstance();
