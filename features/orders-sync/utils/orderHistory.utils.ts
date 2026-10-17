/**
 * Pure utilities extracted from useOrderHistory.
 * No React, no RN, no context — fully testable in node.
 */

import { LocalOrder } from '../../basket/services/BasketServiceInterface';

/** Start-of-day timestamp for a given day offset (0 = today, -1 = yesterday). */
export function getDayStart(daysOffset: number = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Exclusive end-of-day timestamp (= start of next day). */
export function getDayEnd(daysOffset: number = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset + 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Filter a list of LocalOrders to those whose IDs appear in the given set,
 * then sort newest-first.
 */
export function filterAndSortOrders(allOrders: LocalOrder[], allowedIds: Set<string>): LocalOrder[] {
  return allOrders.filter(o => allowedIds.has(o.id)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Determine whether the day navigation "next" button should be enabled.
 * Cashiers can never navigate; non-cashiers can only go forward if not already on today.
 */
export function canNavigateNext(isCashier: boolean, dayOffset: number): boolean {
  return !isCashier && dayOffset < 0;
}

/**
 * Determine whether the day navigation "previous" button should be enabled.
 * Cashiers are locked to today.
 */
export function canNavigatePrev(isCashier: boolean): boolean {
  return !isCashier;
}
