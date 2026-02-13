import { BasketServiceInterface } from './BasketServiceInterface';
import { Basket, BasketItem } from './basket';
import { BasketRepository, BasketRow } from '../../repositories/BasketRepository';
import { LoggerInterface } from '../logger/LoggerInterface';
import { DEFAULT_TAX_RATE } from '../config/POSConfigService';
import { multiplyMoney, sumMoney, calculateTax, roundMoney } from '../../utils/money';
import { generateUUID } from '../../utils/uuid';

/**
 * Basket service — cart CRUD only.
 * Checkout, payment and sync live in their own services.
 */
export class BasketService implements BasketServiceInterface {
  private currentBasketId: string | null = null;

  constructor(
    private basketRepo: BasketRepository,
    private logger: LoggerInterface
  ) {}

  async initialize(): Promise<void> {
    await this.getOrCreateBasket();
  }

  // ── Public API ──────────────────────────────────────────────────────

  async getBasket(): Promise<Basket> {
    return this.getOrCreateBasket();
  }

  async addItem(item: Omit<BasketItem, 'id'>): Promise<Basket> {
    const basket = await this.getOrCreateBasket();

    const existingIndex = basket.items.findIndex(i => i.productId === item.productId && i.variantId === item.variantId);

    if (existingIndex !== -1) {
      basket.items[existingIndex].quantity += item.quantity;
    } else {
      basket.items.push({ ...item, id: generateUUID() });
    }

    return this.recalculateAndSave(basket);
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<Basket> {
    const basket = await this.getOrCreateBasket();

    if (quantity <= 0) {
      basket.items = basket.items.filter(i => i.id !== itemId);
    } else {
      const item = basket.items.find(i => i.id === itemId);
      if (item) item.quantity = quantity;
    }

    return this.recalculateAndSave(basket);
  }

  async removeItem(itemId: string): Promise<Basket> {
    return this.updateItemQuantity(itemId, 0);
  }

  async clearBasket(): Promise<void> {
    if (!this.currentBasketId) return;
    await this.basketRepo.clearBasket(this.currentBasketId);
    this.currentBasketId = null;
  }

  async applyDiscount(code: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    // TODO: Validate discount code against platform/local discounts
    basket.discountCode = code;
    basket.discountAmount = 0;
    basket.updatedAt = new Date();
    await this.updateBasketInDb(basket);
    return basket;
  }

  async removeDiscount(): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    basket.discountCode = undefined;
    basket.discountAmount = undefined;
    return this.recalculateAndSave(basket);
  }

  async setCustomer(email?: string, name?: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    basket.customerEmail = email;
    basket.customerName = name;
    basket.updatedAt = new Date();
    await this.updateBasketInDb(basket);
    return basket;
  }

  async setNote(note: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    basket.note = note;
    basket.updatedAt = new Date();
    await this.updateBasketInDb(basket);
    return basket;
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private async getOrCreateBasket(): Promise<Basket> {
    try {
      const existing = await this.basketRepo.findActiveBasket();

      if (existing) {
        this.currentBasketId = existing.id;
        return this.mapRow(existing);
      }

      const id = generateUUID();
      await this.basketRepo.createBasket({ id, items: '[]', subtotal: 0, tax: 0, total: 0 });
      this.currentBasketId = id;

      const now = Date.now();
      return { id, items: [], subtotal: 0, tax: 0, total: 0, createdAt: new Date(now), updatedAt: new Date(now) };
    } catch (error) {
      this.logger.error({ message: 'Failed to get or create basket' }, error as Error);
      throw error;
    }
  }

  private mapRow(row: BasketRow): Basket {
    return {
      id: row.id,
      items: JSON.parse(row.items) as BasketItem[],
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      discountAmount: row.discount_amount ?? undefined,
      discountCode: row.discount_code ?? undefined,
      customerEmail: row.customer_email ?? undefined,
      customerName: row.customer_name ?? undefined,
      note: row.note ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private calculateTotals(items: BasketItem[], discountAmount: number = 0) {
    const lineTotals = items.map(item => multiplyMoney(item.price, item.quantity));
    const subtotal = sumMoney(lineTotals);
    const taxableAmount = sumMoney(items.filter(i => i.taxable).map(i => multiplyMoney(i.price, i.quantity)));
    const tax = calculateTax(taxableAmount, DEFAULT_TAX_RATE());
    const total = Math.max(0, roundMoney(subtotal + tax - discountAmount));
    return { subtotal, tax, total };
  }

  private async recalculateAndSave(basket: Basket): Promise<Basket> {
    const totals = this.calculateTotals(basket.items, basket.discountAmount);
    basket.subtotal = totals.subtotal;
    basket.tax = totals.tax;
    basket.total = totals.total;
    basket.updatedAt = new Date();
    await this.updateBasketInDb(basket);
    return basket;
  }

  private async updateBasketInDb(basket: Basket): Promise<void> {
    await this.basketRepo.updateBasket(basket.id, {
      items: JSON.stringify(basket.items),
      subtotal: basket.subtotal,
      tax: basket.tax,
      total: basket.total,
      discountAmount: basket.discountAmount ?? null,
      discountCode: basket.discountCode ?? null,
      customerEmail: basket.customerEmail ?? null,
      customerName: basket.customerName ?? null,
      note: basket.note ?? null,
    });
  }
}
