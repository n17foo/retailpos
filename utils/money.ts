/**
 * Money utility functions for safe currency calculations.
 *
 * All monetary math is done in integer cents to avoid IEEE 754
 * floating-point rounding errors (e.g. 0.1 + 0.2 !== 0.3).
 *
 * Public API works with dollar amounts (number) so callers don't
 * need to think about cents — conversion happens internally.
 */

/** Convert dollars to integer cents, rounding to the nearest cent. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Convert integer cents back to a dollar amount (2 decimal places). */
export function toDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Round a dollar amount to 2 decimal places. */
export function roundMoney(amount: number): number {
  return toDollars(toCents(amount));
}

/** Multiply a dollar price by an integer quantity, returning dollars. */
export function multiplyMoney(price: number, quantity: number): number {
  return toDollars(toCents(price) * quantity);
}

/** Add two dollar amounts, returning dollars. */
export function addMoney(a: number, b: number): number {
  return toDollars(toCents(a) + toCents(b));
}

/** Subtract b from a in dollars, returning dollars. */
export function subtractMoney(a: number, b: number): number {
  return toDollars(toCents(a) - toCents(b));
}

/** Sum an array of dollar amounts, returning dollars. */
export function sumMoney(amounts: number[]): number {
  const totalCents = amounts.reduce((sum, amt) => sum + toCents(amt), 0);
  return toDollars(totalCents);
}

/**
 * Calculate tax on a dollar amount at the given rate.
 * Rate is a decimal (e.g. 0.08 for 8%).
 * Returns dollars, rounded to nearest cent.
 */
export function calculateTax(amount: number, rate: number): number {
  return toDollars(Math.round(toCents(amount) * rate));
}

/**
 * Format a dollar amount for display (e.g. "$19.99").
 * Always shows exactly 2 decimal places.
 */
export function formatMoney(amount: number, currencySymbol: string = '$'): string {
  return `${currencySymbol}${roundMoney(amount).toFixed(2)}`;
}

/**
 * Calculate the line total for a basket item.
 * Returns { lineTotal, taxAmount } in dollars.
 */
export function calculateLineTotal(
  price: number,
  quantity: number,
  taxable: boolean,
  taxRate: number
): { lineTotal: number; taxAmount: number } {
  const lineTotal = multiplyMoney(price, quantity);
  const taxAmount = taxable ? calculateTax(lineTotal, taxRate) : 0;
  return { lineTotal, taxAmount };
}
