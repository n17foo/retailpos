/**
 * orderRow.utils — unit tests
 *
 * Tests the OrderRow → OrderWithItems domain mapper.
 * No React, no RN, no repository dependencies.
 */

import { rowToOrder } from './orderRow.utils';
import { OrderRow } from '../repositories/OrderRepository';
import { OrderItemRow } from '../repositories/OrderItemRepository';

// ── Helpers ───────────────────────────────────────────────────────────────

const now = Date.now();

function makeRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'order-1',
    platform_order_id: null,
    platform: null,
    subtotal: 18.0,
    tax: 1.44,
    total: 19.44,
    discount_amount: null,
    discount_code: null,
    customer_email: null,
    customer_name: 'Jane Doe',
    note: null,
    sale_mode: null,
    payment_method: 'cash',
    payment_transaction_id: null,
    cashier_id: 'c1',
    cashier_name: 'Alice',
    register_id: null,
    status: 'paid',
    sync_status: 'synced',
    sync_error: null,
    created_at: now,
    updated_at: now,
    paid_at: now,
    synced_at: now,
    payments_json: null,
    ...overrides,
  };
}

const sampleItems: OrderItemRow[] = [
  {
    id: 'item-1',
    order_id: 'order-1',
    product_id: 'prod-1',
    variant_id: null,
    name: 'Widget',
    sku: null,
    price: 9.0,
    quantity: 2,
    image: null,
    taxable: 1,
    tax_rate: null,
    is_ecommerce_product: 0,
    original_id: null,
    properties: null,
    option_summary: null,
    tax_code: null,
    tax_profile_id: null,
    inventory_policy: null,
    catalog_version: null,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────

describe('rowToOrder', () => {
  it('maps all scalar fields correctly', () => {
    const order = rowToOrder(makeRow(), []);

    expect(order.id).toBe('order-1');
    expect(order.subtotal).toBe(18.0);
    expect(order.tax).toBe(1.44);
    expect(order.total).toBe(19.44);
    expect(order.status).toBe('paid');
    expect(order.syncStatus).toBe('synced');
    expect(order.paymentMethod).toBe('cash');
    expect(order.customerName).toBe('Jane Doe');
    expect(order.cashierName).toBe('Alice');
  });

  it('converts created_at timestamp to a Date object', () => {
    const order = rowToOrder(makeRow({ created_at: now }), []);

    expect(order.createdAt).toBeInstanceOf(Date);
    expect(order.createdAt.getTime()).toBe(now);
  });

  it('attaches the provided items array', () => {
    const order = rowToOrder(makeRow(), sampleItems);

    expect(order.items).toBe(sampleItems);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].name).toBe('Widget');
  });

  it('returns an empty items array when none are provided', () => {
    const order = rowToOrder(makeRow(), []);

    expect(order.items).toHaveLength(0);
  });

  it('maps null paymentMethod correctly', () => {
    const order = rowToOrder(makeRow({ payment_method: null }), []);

    expect(order.paymentMethod).toBeNull();
  });

  it('maps null customerName correctly', () => {
    const order = rowToOrder(makeRow({ customer_name: null }), []);

    expect(order.customerName).toBeNull();
  });

  it('maps null cashierName correctly', () => {
    const order = rowToOrder(makeRow({ cashier_name: null }), []);

    expect(order.cashierName).toBeNull();
  });

  it('maps sync_status to syncStatus (camelCase)', () => {
    const order = rowToOrder(makeRow({ sync_status: 'pending' }), []);

    expect(order.syncStatus).toBe('pending');
  });
});
