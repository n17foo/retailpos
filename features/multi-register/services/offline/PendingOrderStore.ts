import { db } from '../../../../shared/utils/db';
import { generateUUID } from '../../../../shared/utils/uuid';
import { orderRepository } from '../../../orders-sync/repositories/OrderRepository';
import { orderItemRepository } from '../../../orders-sync/repositories/OrderItemRepository';
import type { CreateOrderInput, OrderRow } from '../../../orders-sync/repositories/OrderRepository';
import type { CreateOrderItemInput } from '../../../orders-sync/repositories/OrderItemRepository';
import { instoreApiClient } from '../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { instoreApiConfig } from '../InstoreApiConfig';
import { storeApiHealthService } from '../StoreApiHealthService';
import { isStoreApiUnavailable } from './isStoreApiUnavailable';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

/** sync_status marker for orders written locally while the LAN is down. */
export const PENDING_UPLOAD = 'pending_upload';

/**
 * Ops queued against orders the server already knows about (created while
 * online, mutated during the outage). Replayed FIFO after pending orders have
 * been uploaded.
 */
type PendingOpKind = 'update_status' | 'update_payment' | 'update_sync';

interface PendingOpRow {
  id: string;
  kind: PendingOpKind;
  payload: string;
  created_at: number;
}

/**
 * LAN-outage write buffer for client-mode registers.
 *
 * When the Store API is unreachable, sales still need to work: orders and
 * their paid/cancelled updates are written to local SQLite (orders flagged
 * `sync_status='pending_upload'`) and uploaded to the server — original id,
 * register, cashier and timestamps preserved — as soon as the health service
 * reports the LAN is back. Order-history reads merge these rows so the sale
 * is visible immediately even though it hasn't reached the server yet.
 *
 * This is NOT a mode swap: the server stays authoritative — these rows are a
 * queue, not a second source of truth.
 */
export class PendingOrderStore {
  private static instance: PendingOrderStore;
  private logger = LoggerFactory.getInstance().createLogger('PendingOrderStore');
  private started = false;
  private unsubscribeRecovery: (() => void) | null = null;
  private flushing = false;

  private constructor() {}

  static getInstance(): PendingOrderStore {
    if (!PendingOrderStore.instance) {
      PendingOrderStore.instance = new PendingOrderStore();
    }
    return PendingOrderStore.instance;
  }

  /** Subscribe to LAN recovery so the queue drains itself. */
  start(): void {
    if (this.started || !instoreApiConfig.isClient) return;
    this.started = true;
    this.unsubscribeRecovery = storeApiHealthService.onRecovery(() => {
      this.flush().catch(error => {
        this.logger.error({ message: 'Pending-order flush failed' }, error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  stop(): void {
    this.started = false;
    this.unsubscribeRecovery?.();
    this.unsubscribeRecovery = null;
  }

  /** Write an order (with items) locally, marked for upload. */
  async queueOrder(input: CreateOrderInput, items: CreateOrderItemInput[]): Promise<void> {
    await orderRepository.createWithItems(input, items);
    await db.runAsync('UPDATE orders SET sync_status = ? WHERE id = ?', [PENDING_UPLOAD, input.id]);
    this.logger.info({ message: `Order ${input.id} queued locally — LAN down` });
  }

  async isPending(orderId: string): Promise<boolean> {
    const row = await db.getFirstAsync<{ sync_status: string }>('SELECT sync_status FROM orders WHERE id = ?', [orderId]);
    return row?.sync_status === PENDING_UPLOAD;
  }

  /** Locally-queued orders — merged into list/detail reads while degraded. */
  async listPending(status?: string): Promise<OrderRow[]> {
    const rows = await db.getAllAsync<OrderRow>(
      `SELECT * FROM orders WHERE sync_status = ? ${status ? 'AND status = ?' : ''} ORDER BY created_at DESC`,
      status ? [PENDING_UPLOAD, status] : [PENDING_UPLOAD]
    );
    return rows;
  }

  async findPendingById(orderId: string): Promise<OrderRow | null> {
    return db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ? AND sync_status = ?', [orderId, PENDING_UPLOAD]);
  }

  /**
   * Apply a mutation that couldn't reach the server. For orders that are only
   * queued locally the change is applied to the local row directly (the whole
   * order uploads with its final state); for server-known orders the op is
   * recorded and replayed on recovery.
   */
  async applyOrQueueStatus(orderId: string, status: string): Promise<void> {
    if (await this.isPending(orderId)) {
      await orderRepository.updateStatus(orderId, status);
      return;
    }
    await this.queueOp('update_status', { orderId, status });
  }

  async applyOrQueuePayment(orderId: string, paymentMethod: string, transactionId: string | null, paymentsJson?: string): Promise<void> {
    if (await this.isPending(orderId)) {
      if (paymentsJson !== undefined) {
        await orderRepository.updatePaymentLines(orderId, paymentMethod, transactionId, paymentsJson);
      } else {
        await orderRepository.updatePayment(orderId, paymentMethod, transactionId);
      }
      return;
    }
    await this.queueOp('update_payment', { orderId, paymentMethod, transactionId, paymentsJson });
  }

  async applyOrQueueSyncResult(orderId: string, syncStatus: string, platformOrderId?: string, syncError?: string): Promise<void> {
    if (await this.isPending(orderId)) return; // not on the server yet — upload carries final state
    await this.queueOp('update_sync', { orderId, syncStatus, platformOrderId, syncError });
  }

  private async queueOp(kind: PendingOpKind, payload: Record<string, unknown>): Promise<void> {
    await db.runAsync('INSERT INTO pending_ops (id, kind, payload, created_at) VALUES (?, ?, ?, ?)', [
      `pop_${generateUUID()}`,
      kind,
      JSON.stringify(payload),
      Date.now(),
    ]);
    this.logger.info({ message: `Queued ${kind} op — LAN down` });
  }

  /**
   * Upload queued orders then replay queued ops, oldest first. Stops at the
   * first unreachable failure; a rejected order stays queued (flagged via
   * upload_attempts) so one bad row can't poison the queue.
   */
  async flush(): Promise<void> {
    if (this.flushing || storeApiHealthService.isDegraded) return;
    this.flushing = true;
    try {
      const pending = await this.listPending();
      if (pending.length > 0) {
        this.logger.info({ message: `Uploading ${pending.length} queued order(s) to Store API` });
      }
      for (const row of pending) {
        try {
          const items = await orderItemRepository.findByOrderId(row.id);
          await instoreApiClient.createOrder(orderRowToInput(row), items.map(itemRowToInput));
          await orderItemRepository.deleteByOrderId(row.id);
          await db.runAsync('DELETE FROM orders WHERE id = ?', [row.id]);
          this.logger.info({ message: `Uploaded queued order ${row.id}` });
        } catch (error) {
          if (isStoreApiUnavailable(error)) return; // still down — retry next cycle
          this.logger.error(
            { message: `Queued order ${row.id} rejected by server` },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      const ops = await db.getAllAsync<PendingOpRow>('SELECT * FROM pending_ops ORDER BY created_at ASC');
      for (const op of ops) {
        try {
          await this.replayOp(op);
          await db.runAsync('DELETE FROM pending_ops WHERE id = ?', [op.id]);
        } catch (error) {
          if (isStoreApiUnavailable(error)) return;
          this.logger.error(
            { message: `Pending op ${op.id} (${op.kind}) failed` },
            error instanceof Error ? error : new Error(String(error))
          );
          await db.runAsync('DELETE FROM pending_ops WHERE id = ?', [op.id]);
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  private async replayOp(op: PendingOpRow): Promise<void> {
    const payload = JSON.parse(op.payload) as Record<string, unknown>;
    const orderId = payload.orderId as string;
    switch (op.kind) {
      case 'update_status':
        await instoreApiClient.updateOrderStatus(orderId, payload.status as string);
        return;
      case 'update_payment':
        await instoreApiClient.updateOrderPayment(
          orderId,
          payload.paymentMethod as string,
          payload.transactionId as string | undefined,
          payload.paymentsJson as string | undefined
        );
        return;
      case 'update_sync':
        await instoreApiClient.updateOrderSync(
          orderId,
          payload.syncStatus as string,
          payload.platformOrderId as string | undefined,
          payload.syncError as string | undefined
        );
        return;
    }
  }
}

function orderRowToInput(row: OrderRow): CreateOrderInput {
  return {
    id: row.id,
    platform: row.platform,
    platformOrderId: row.platform_order_id,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    discountAmount: row.discount_amount,
    discountCode: row.discount_code,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    note: row.note,
    saleMode: row.sale_mode,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    registerId: row.register_id,
    status: row.status,
    paymentsJson: row.payments_json,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

function itemRowToInput(item: import('../../../orders-sync/repositories/OrderItemRepository').OrderItemRow): CreateOrderItemInput {
  return {
    orderId: item.order_id,
    productId: item.product_id,
    variantId: item.variant_id,
    sku: item.sku,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    image: item.image,
    taxable: item.taxable === 1,
    taxRate: item.tax_rate,
    isEcommerceProduct: item.is_ecommerce_product === 1,
    originalId: item.original_id,
    properties: item.properties ? (JSON.parse(item.properties) as Record<string, string>) : undefined,
  };
}

export const pendingOrderStore = PendingOrderStore.getInstance();
