/**
 * Pure row-to-domain mapper extracted from useOrders.
 * No React, no RN, no repository dependencies.
 */

import { OrderRow } from '../repositories/OrderRepository';
import { OrderItemRow } from '../repositories/OrderItemRepository';

export interface OrderWithItems {
  id: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  syncStatus: string;
  paymentMethod: string | null;
  customerName: string | null;
  cashierName: string | null;
  saleMode: string | null;
  createdAt: Date;
  items: OrderItemRow[];
}

export function rowToOrder(row: OrderRow, items: OrderItemRow[]): OrderWithItems {
  return {
    id: row.id,
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    status: row.status,
    syncStatus: row.sync_status,
    paymentMethod: row.payment_method,
    customerName: row.customer_name,
    cashierName: row.cashier_name,
    saleMode: row.sale_mode,
    createdAt: new Date(row.created_at),
    items,
  };
}
