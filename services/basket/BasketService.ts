import { BasketServiceInterface } from './BasketServiceInterface';
import { Basket, BasketItem } from './basket';
import { BasketRepository, BasketRow } from '../../repositories/BasketRepository';
import { LoggerInterface } from '../logger/LoggerInterface';
import { multiplyMoney, sumMoney, roundMoney } from '../../utils/money';
import { generateUUID } from '../../utils/uuid';
import { localCustomerService } from '../customer/LocalCustomerService';
import { DiscountServiceFactory } from '../discount/DiscountServiceFactory';
import { ECommercePlatform } from '../../utils/platforms';

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

  async applyDiscount(code: string, platform?: ECommercePlatform): Promise<Basket> {
    const basket = await this.getOrCreateBasket();

    try {
      // Get discount service for current platform
      const discountService = DiscountServiceFactory.getInstance().getService(platform);

      // Validate discount code and calculate discount amount
      const validation = await discountService.validateDiscount(code, basket.subtotal);

      if (!validation.valid) {
        this.logger.warn({ message: `Discount validation failed: ${code}`, error: validation.error });
        throw new Error(validation.error || 'Invalid discount code');
      }

      // Apply validated discount
      basket.discountCode = code;
      basket.discountAmount = validation.discountAmount;
      basket.updatedAt = new Date();

      // Recalculate totals with discount applied
      await this.recalculateAndSave(basket);

      this.logger.info({
        message: `Discount applied: ${code}`,
        amount: validation.discountAmount,
        type: validation.discountType,
      });

      return basket;
    } catch (error) {
      this.logger.error({ message: `Error applying discount: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
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

    // Upsert local customer profile (non-blocking)
    if (email) {
      localCustomerService.upsert({ email, name }).catch(() => {});
    }

    return basket;
  }

  async setNote(note: string): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    basket.note = note;
    basket.updatedAt = new Date();
    await this.updateBasketInDb(basket);
    return basket;
  }

  async setSaleMode(mode: string | undefined): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    basket.saleMode = mode;
    basket.updatedAt = new Date();
    await this.updateBasketInDb(basket);
    return basket;
  }

  /**
   * Merge key-value properties onto a basket line (e.g. a line note).
   * Persisted inside the items JSON blob.
   */
  async updateItemProperties(itemId: string, properties: Record<string, string>): Promise<Basket> {
    const basket = await this.getOrCreateBasket();
    const item = basket.items.find(i => i.id === itemId);
    if (item) {
      item.properties = { ...item.properties, ...properties };
      basket.updatedAt = new Date();
      await this.updateBasketInDb(basket);
    }
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
      saleMode: row.sale_mode ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private calculateTotals(items: BasketItem[], discountAmount: number = 0) {
    const lineTotals = items.map(item => multiplyMoney(item.price, item.quantity));
    const subtotal = sumMoney(lineTotals);

    // Spec requirement 1.4: Calculate tax per-item using stored taxRate
    // Tax uses only the rate stored on the item when it was added. An item without a rate (platform
    // gave none) contributes no local tax; the platform's own calculation is used at checkout.
    const taxAmounts = items.map(item => {
      if (item.taxable === false || item.taxRate === undefined) return 0;

      const lineTotal = multiplyMoney(item.price, item.quantity);
      return multiplyMoney(lineTotal, item.taxRate);
    });

    const tax = sumMoney(taxAmounts);

    // Spec requirement 1.5: total = max(0, roundMoney(subtotal + tax - discountAmount))
    const total = Math.max(0, roundMoney(subtotal + tax - discountAmount));

    return { subtotal, tax, total };
  }

  private async recalculateAndSave(basket: Basket): Promise<Basket> {
    const totals = this.calculateTotals(basket.items, basket.discountAmount);
    basket.subtotal = totals.subtotal;
    basket.tax = totals.tax; // Spec requirement 1.2: Update tax after every operation
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
      saleMode: basket.saleMode ?? null,
    });
  }
}
