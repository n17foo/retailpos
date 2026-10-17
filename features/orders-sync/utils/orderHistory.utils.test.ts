/**
 * orderHistory.utils — unit tests
 *
 * Tests day-range helpers, order filtering/sorting, and navigation guards.
 * No React, no RN, no context.
 */

import { getDayStart, getDayEnd, filterAndSortOrders, canNavigateNext, canNavigatePrev } from './orderHistory.utils';
import { LocalOrder } from '../../basket/services/BasketServiceInterface';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeOrder(id: string, createdAt: Date): LocalOrder {
  return {
    id,
    platformOrderId: undefined,
    platform: undefined,
    status: 'paid',
    syncStatus: 'synced',
    items: [],
    subtotal: 10,
    tax: 0.8,
    total: 10.8,
    discountAmount: 0,
    paymentMethod: 'cash',
    cashierId: 'c1',
    cashierName: 'Alice',
    createdAt,
    updatedAt: createdAt,
  };
}

// ── getDayStart ───────────────────────────────────────────────────────────

describe('getDayStart', () => {
  it('returns midnight of today for offset 0', () => {
    const ts = getDayStart(0);
    const d = new Date(ts);

    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('returns a timestamp in the past for negative offsets', () => {
    const today = getDayStart(0);
    const yesterday = getDayStart(-1);

    expect(yesterday).toBeLessThan(today);
    expect(today - yesterday).toBe(86_400_000); // exactly 1 day
  });

  it('returns a timestamp in the future for positive offsets', () => {
    const today = getDayStart(0);
    const tomorrow = getDayStart(1);

    expect(tomorrow).toBeGreaterThan(today);
    expect(tomorrow - today).toBe(86_400_000);
  });
});

// ── getDayEnd ─────────────────────────────────────────────────────────────

describe('getDayEnd', () => {
  it('is exactly 24 hours after getDayStart for the same offset', () => {
    const start = getDayStart(0);
    const end = getDayEnd(0);

    expect(end - start).toBe(86_400_000);
  });

  it('end of yesterday equals start of today', () => {
    expect(getDayEnd(-1)).toBe(getDayStart(0));
  });
});

// ── filterAndSortOrders ───────────────────────────────────────────────────

describe('filterAndSortOrders', () => {
  const now = Date.now();
  const o1 = makeOrder('order-1', new Date(now - 3_000));
  const o2 = makeOrder('order-2', new Date(now - 1_000));
  const o3 = makeOrder('order-3', new Date(now - 2_000));
  const o4 = makeOrder('order-4', new Date(now - 4_000));

  it('returns only orders whose IDs are in the allowed set', () => {
    const allowed = new Set(['order-1', 'order-3']);
    const result = filterAndSortOrders([o1, o2, o3, o4], allowed);

    expect(result.map(o => o.id)).toEqual(expect.arrayContaining(['order-1', 'order-3']));
    expect(result).toHaveLength(2);
  });

  it('sorts results newest-first', () => {
    const allowed = new Set(['order-1', 'order-2', 'order-3', 'order-4']);
    const result = filterAndSortOrders([o4, o1, o3, o2], allowed);

    expect(result[0].id).toBe('order-2'); // most recent
    expect(result[result.length - 1].id).toBe('order-4'); // oldest
  });

  it('returns an empty array when no IDs match', () => {
    const result = filterAndSortOrders([o1, o2], new Set(['order-99']));

    expect(result).toHaveLength(0);
  });

  it('returns an empty array when allOrders is empty', () => {
    const result = filterAndSortOrders([], new Set(['order-1']));

    expect(result).toHaveLength(0);
  });

  it('returns an empty array when allowedIds is empty', () => {
    const result = filterAndSortOrders([o1, o2], new Set());

    expect(result).toHaveLength(0);
  });

  it('handles a single order correctly', () => {
    const result = filterAndSortOrders([o1], new Set(['order-1']));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-1');
  });
});

// ── canNavigateNext ───────────────────────────────────────────────────────

describe('canNavigateNext', () => {
  it('returns false for cashiers regardless of offset', () => {
    expect(canNavigateNext(true, -1)).toBe(false);
    expect(canNavigateNext(true, -5)).toBe(false);
    expect(canNavigateNext(true, 0)).toBe(false);
  });

  it('returns false when already on today (offset 0)', () => {
    expect(canNavigateNext(false, 0)).toBe(false);
  });

  it('returns true for non-cashiers viewing a past day', () => {
    expect(canNavigateNext(false, -1)).toBe(true);
    expect(canNavigateNext(false, -7)).toBe(true);
  });
});

// ── canNavigatePrev ───────────────────────────────────────────────────────

describe('canNavigatePrev', () => {
  it('returns false for cashiers', () => {
    expect(canNavigatePrev(true)).toBe(false);
  });

  it('returns true for admins and managers', () => {
    expect(canNavigatePrev(false)).toBe(true);
  });
});
