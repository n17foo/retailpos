import { roundMoney } from '../../../shared/utils/money';
import type { TaxQuote } from '../../orders-sync/services/order/OrderServiceInterface';

export interface QuotedTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Applies a platform tax quote to what the customer is actually charged.
 *
 * The platform calculated `quote.tax` on `quote.subtotal` (net), which gives its effective tax rate for this basket.
 * That rate is applied to the POS amount after any POS discount, because tax is charged on the discounted amount.
 * Prices that already include tax keep the total unchanged and report the included portion.
 */
export function applyTaxQuote(basketSubtotal: number, discountAmount: number, quote: TaxQuote): QuotedTotals {
  const base = Math.max(0, roundMoney(basketSubtotal - discountAmount));

  if (!(quote.subtotal > 0) || !(quote.tax > 0)) {
    return { subtotal: basketSubtotal, tax: 0, total: base };
  }

  const rate = quote.tax / quote.subtotal;

  if (quote.taxIncluded) {
    return { subtotal: basketSubtotal, tax: roundMoney(base - base / (1 + rate)), total: base };
  }

  const tax = roundMoney(base * rate);
  return { subtotal: basketSubtotal, tax, total: roundMoney(base + tax) };
}
