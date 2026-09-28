import type { ReturnRow } from '../../repositories/ReturnRepository';
import type { OrderItemRow } from '../../repositories/OrderItemRepository';
import { sumMoney, toCents } from '../../utils/money';

export interface ReturnLineRequest {
  orderItemId?: string | null;
  productId: string;
  quantity: number;
  refundAmount: number;
}

export interface ReturnValidationContext {
  orderStatus: string;
  orderTotal?: number | null;
  orderItems: Pick<OrderItemRow, 'id' | 'product_id' | 'quantity'>[];
  existingReturns: Pick<ReturnRow, 'order_item_id' | 'product_id' | 'quantity' | 'refund_amount' | 'status'>[];
}

const MAX_RETURN_LINES = 200;
const COUNTED_RETURN_STATUSES = new Set(['completed', 'approved']);

/**
 * Validate a return request against the original sale.
 *
 * Prevents refund fraud and data corruption from the UI or from LAN clients:
 * returns must reference a paid order, quantities must be positive integers
 * not exceeding what remains returnable per line, and the cumulative refund
 * can never exceed the order total. Returns an error message, or null if valid.
 */
export function validateReturnRequest(items: ReturnLineRequest[], ctx: ReturnValidationContext): string | null {
  if (ctx.orderStatus !== 'paid' && ctx.orderStatus !== 'synced') {
    return 'Order must be paid before processing a return';
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_RETURN_LINES) {
    return 'Invalid return items';
  }

  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !item.productId) return 'Invalid return item';
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) return 'Return quantity must be a positive whole number';
    if (!Number.isFinite(item.refundAmount) || item.refundAmount < 0) return 'Refund amount must be zero or greater';
  }

  // Per-line quantity limits (only when the original lines are available locally)
  if (ctx.orderItems.length > 0) {
    const counted = ctx.existingReturns.filter(r => COUNTED_RETURN_STATUSES.has(r.status));
    const requested = new Map<string, number>();

    for (const item of items) {
      const line = item.orderItemId
        ? ctx.orderItems.find(oi => oi.id === item.orderItemId)
        : ctx.orderItems.find(oi => oi.product_id === item.productId);
      if (!line || line.product_id !== item.productId) return 'Return item does not belong to this order';
      requested.set(line.id, (requested.get(line.id) ?? 0) + item.quantity);
    }

    for (const [lineId, qty] of requested) {
      const line = ctx.orderItems.find(oi => oi.id === lineId)!;
      const alreadyReturned = counted
        .filter(r => r.order_item_id === lineId || (!r.order_item_id && r.product_id === line.product_id))
        .reduce((sum, r) => sum + r.quantity, 0);
      if (qty + alreadyReturned > line.quantity) return 'Return quantity exceeds the quantity sold';
    }
  }

  // Cumulative refund cap
  if (typeof ctx.orderTotal === 'number' && Number.isFinite(ctx.orderTotal)) {
    const previous = sumMoney(ctx.existingReturns.filter(r => COUNTED_RETURN_STATUSES.has(r.status)).map(r => r.refund_amount));
    const requestedTotal = sumMoney(items.map(i => i.refundAmount));
    if (toCents(previous) + toCents(requestedTotal) > toCents(ctx.orderTotal)) {
      return 'Refund total exceeds the amount paid for this order';
    }
  }

  return null;
}
