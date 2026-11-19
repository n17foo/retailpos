import type { ReturnRow } from '../../repositories/ReturnRepository';
import type { OrderItemRow } from '../../../orders-sync/repositories/OrderItemRepository';
import { sumMoney, toCents, toDollars } from '../../../../shared/utils/money';

export interface ReturnLineRequest {
  orderItemId?: string | null;
  productId: string;
  quantity: number;
  refundAmount: number;
}

export interface ReturnValidationContext {
  orderStatus: string;
  orderTotal?: number | null;
  /** Pre-discount goods total — needed to allocate the order discount across lines */
  orderSubtotal?: number | null;
  /** Order-level discount in major units — allocated pro-rata across line gross values */
  orderDiscount?: number | null;
  orderItems: Pick<OrderItemRow, 'id' | 'product_id' | 'quantity' | 'price' | 'tax_rate'>[];
  existingReturns: Pick<ReturnRow, 'order_item_id' | 'product_id' | 'quantity' | 'refund_amount' | 'status'>[];
}

const MAX_RETURN_LINES = 200;

/**
 * Return statuses that reserve quantity against the original line.
 * `pending` counts so a return in flight can't be double-submitted by a
 * concurrent request; the reservation releases when the row is rejected
 * or deleted (e.g. by exchange compensation).
 */
export const COUNTED_RETURN_STATUSES = new Set(['pending', 'completed', 'approved']);

type RefundableLine = Pick<OrderItemRow, 'price' | 'quantity' | 'tax_rate'>;
type RefundableOrder = { subtotal?: number | null; discount_amount?: number | null };

/**
 * Amount actually paid for a full order line, in cents: line gross minus its
 * pro-rata share of the order-level discount plus tax on the discounted net.
 * The customer's refund can never exceed what they actually paid for the line
 * (RET-03) — capping at the raw unit price over-refunds discounted orders and
 * omits tax on taxed lines.
 */
function linePaidCents(line: RefundableLine, order: RefundableOrder): number {
  const grossCents = toCents(line.price) * line.quantity;
  const orderSubtotalCents = toCents(order.subtotal ?? 0);
  const discountCents = toCents(order.discount_amount ?? 0);
  const discountShare = orderSubtotalCents > 0 ? Math.round(discountCents * (grossCents / orderSubtotalCents)) : 0;
  const netCents = grossCents - discountShare;
  const taxCents = line.tax_rate != null ? Math.round(netCents * line.tax_rate) : 0;
  return netCents + taxCents;
}

/**
 * Refundable amount (major units) for `quantity` units of an order line —
 * prorated share of what was actually paid for that line, including its
 * allocated discount and tax. Used by the return/exchange UI to pre-fill
 * correct refund amounts instead of the raw unit price.
 */
export function computeLineRefundable(line: RefundableLine, order: RefundableOrder, quantity: number): number {
  if (line.quantity <= 0 || quantity <= 0) return 0;
  return toDollars(Math.round((linePaidCents(line, order) * Math.min(quantity, line.quantity)) / line.quantity));
}

/**
 * Validate a return request against the original sale.
 *
 * Prevents refund fraud and data corruption from the UI or from LAN clients:
 * returns must reference a paid order, quantities must be positive integers
 * not exceeding what remains returnable per line, the refund per line can
 * never exceed what was actually paid for that line (discount- and tax-
 * adjusted), and the cumulative refund can never exceed the order total.
 * Returns an error message, or null if valid.
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

  // Per-line quantity + refund limits (only when the original lines are available locally)
  if (ctx.orderItems.length > 0) {
    const counted = ctx.existingReturns.filter(r => COUNTED_RETURN_STATUSES.has(r.status));
    const requested = new Map<string, { qty: number; refundCents: number }>();

    for (const item of items) {
      const line = item.orderItemId
        ? ctx.orderItems.find(oi => oi.id === item.orderItemId)
        : ctx.orderItems.find(oi => oi.product_id === item.productId);
      if (!line || line.product_id !== item.productId) return 'Return item does not belong to this order';
      const entry = requested.get(line.id) ?? { qty: 0, refundCents: 0 };
      entry.qty += item.quantity;
      entry.refundCents += toCents(item.refundAmount);
      requested.set(line.id, entry);
    }

    for (const [lineId, req] of requested) {
      const line = ctx.orderItems.find(oi => oi.id === lineId)!;
      const prior = counted.filter(r => r.order_item_id === lineId || (!r.order_item_id && r.product_id === line.product_id));
      const alreadyReturned = prior.reduce((sum, r) => sum + r.quantity, 0);
      if (req.qty + alreadyReturned > line.quantity) return 'Return quantity exceeds the quantity sold';

      // Per-line refund cap: paid amount for the returned share of this line
      // (net of the line's discount allocation, plus its tax), minus whatever
      // earlier returns already refunded against it.
      const paidForQtyCents = Math.round(
        (linePaidCents(line, { subtotal: ctx.orderSubtotal, discount_amount: ctx.orderDiscount }) * (req.qty + alreadyReturned)) /
          line.quantity
      );
      const alreadyRefundedCents = prior.reduce((sum, r) => sum + toCents(r.refund_amount), 0);
      if (alreadyRefundedCents + req.refundCents > paidForQtyCents) {
        return 'Refund exceeds the amount paid for this item';
      }
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
