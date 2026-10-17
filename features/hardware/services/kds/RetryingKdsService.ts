import { KdsServiceInterface, KdsOrder, KdsConnectionConfig, KdsDriverType, KdsStatusUpdate } from './KdsServiceInterface';
import { PendingKdsTicket, PendingKdsTicketStore, pendingKdsTicketStore } from './PendingKdsTicketStore';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { LoggerInterface } from '../../../../shared/services/logger/LoggerInterface';
import { notificationService } from '../../../../shared/services/notifications/NotificationService';

/**
 * Decorator that persists failed order tickets and replays them on the next
 * successful send or reconnect — closes the gap where a KDS outage silently
 * dropped tickets the kitchen never saw.
 *
 * Retry semantics: at-least-once. Tickets coalesce per orderId, so a ticket
 * replayed after the KDS already received it may re-display the same order.
 */
export class RetryingKdsService implements KdsServiceInterface {
  private readonly logger: LoggerInterface = LoggerFactory.getInstance().createLogger('RetryingKdsService');
  private draining = false;

  constructor(
    private readonly inner: KdsServiceInterface,
    private readonly store: PendingKdsTicketStore = pendingKdsTicketStore
  ) {}

  get driverType(): KdsDriverType {
    return this.inner.driverType;
  }

  async connect(config: KdsConnectionConfig): Promise<boolean> {
    const connected = await this.inner.connect(config);
    if (connected) {
      this.drain().catch(() => {});
    }
    return connected;
  }

  disconnect(): Promise<void> {
    return this.inner.disconnect();
  }

  isConnected(): boolean {
    return this.inner.isConnected();
  }

  async sendOrder(order: KdsOrder): Promise<boolean> {
    let accepted: boolean;
    try {
      accepted = await this.inner.sendOrder(order);
    } catch {
      accepted = false;
    }

    if (!accepted) {
      await this.queueTicket(order);
      return false;
    }

    // A successful send proves connectivity — replay queued tickets
    this.drain().catch(() => {});
    return true;
  }

  recallOrder(orderId: string): Promise<boolean> {
    return this.inner.recallOrder(orderId);
  }

  cancelOrder(orderId: string): Promise<boolean> {
    return this.inner.cancelOrder(orderId);
  }

  onStatusUpdate(callback: (update: KdsStatusUpdate) => void): string {
    return this.inner.onStatusUpdate(callback);
  }

  offStatusUpdate(subscriptionId: string): void {
    this.inner.offStatusUpdate(subscriptionId);
  }

  /** Replays queued tickets oldest-first. Tickets that fail again stay queued. */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const pending = await this.store.list();
      if (pending.length === 0) return;

      const succeeded: PendingKdsTicket[] = [];
      for (const entry of pending) {
        try {
          if (await this.inner.sendOrder(entry.ticket)) {
            succeeded.push(entry);
          }
        } catch {
          break; // still unreachable — stop draining
        }
      }

      if (succeeded.length > 0) {
        await this.store.remove(succeeded);
        this.logger.info({ message: `Replayed ${succeeded.length} queued KDS ticket(s)` });
      }
    } finally {
      this.draining = false;
    }
  }

  private async queueTicket(order: KdsOrder): Promise<void> {
    try {
      await this.store.add(order);
      this.logger.warn({ message: `KDS unreachable — ticket for order ${order.orderId} queued for retry` });
      notificationService.notify(
        'KDS Unreachable',
        `Order ticket ${order.orderRef} could not be sent — it will retry automatically.`,
        'warning'
      );
    } catch (error) {
      this.logger.error({ message: 'Failed to persist pending KDS ticket' }, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
