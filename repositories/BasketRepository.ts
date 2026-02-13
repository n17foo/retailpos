import { db } from '../utils/db';

/** DB row shape for baskets table */
export interface BasketRow {
  id: string;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  discount_amount: number | null;
  discount_code: string | null;
  customer_email: string | null;
  customer_name: string | null;
  note: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateBasketInput {
  id: string;
  items: string;
  subtotal: number;
  tax: number;
  total: number;
}

export interface UpdateBasketInput {
  items: string;
  subtotal: number;
  tax: number;
  total: number;
  discountAmount: number | null;
  discountCode: string | null;
  customerEmail: string | null;
  customerName: string | null;
  note: string | null;
}

export class BasketRepository {
  async findActiveBasket(): Promise<BasketRow | null> {
    return db.getFirstAsync<BasketRow>('SELECT * FROM baskets WHERE status = ? ORDER BY created_at DESC LIMIT 1', ['active']);
  }

  async createBasket(input: CreateBasketInput): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO baskets (id, items, subtotal, tax, total, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.items, input.subtotal, input.tax, input.total, 'active', now, now]
    );
  }

  async updateBasket(basketId: string, input: UpdateBasketInput): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE baskets SET 
        items = ?, subtotal = ?, tax = ?, total = ?, 
        discount_amount = ?, discount_code = ?,
        customer_email = ?, customer_name = ?, note = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        input.items,
        input.subtotal,
        input.tax,
        input.total,
        input.discountAmount,
        input.discountCode,
        input.customerEmail,
        input.customerName,
        input.note,
        now,
        basketId,
      ]
    );
  }

  async clearBasket(basketId: string): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `UPDATE baskets SET items = ?, subtotal = ?, tax = ?, total = ?, 
       discount_amount = NULL, discount_code = NULL, updated_at = ?
       WHERE id = ?`,
      ['[]', 0, 0, 0, now, basketId]
    );
  }
}

export const basketRepository = new BasketRepository();
