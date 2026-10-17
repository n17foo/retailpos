import { BaseDiscountService } from './BaseDiscountService';
import { DiscountValidationResult, DiscountCode } from './DiscountServiceInterface';
import { DiscountRepository, DiscountRow } from '../../repositories/DiscountRepository';

/**
 * Local Discount Service
 * Validates discount codes against local SQLite database
 * Used for offline mode and as fallback for online platforms
 */
export class LocalDiscountService extends BaseDiscountService {
  private discountRepo: DiscountRepository;

  constructor() {
    super('LocalDiscountService');
    this.discountRepo = new DiscountRepository();
  }

  async initialize(): Promise<void> {
    await this.discountRepo.initialize();
    await super.initialize();
  }

  async validateDiscount(code: string, subtotal: number): Promise<DiscountValidationResult> {
    try {
      // Find discount code in database
      const discountRow = await this.discountRepo.findByCode(code);

      if (!discountRow) {
        this.logger.warn({ message: `Discount code not found: ${code}` });
        return this.createInvalidResult(code, 'Invalid discount code');
      }

      // Map to DiscountCode
      const discount = this.discountRepo.mapRowToDiscount(discountRow);

      // Validate discount rules
      const validation = this.validateDiscountRules(discount, subtotal);
      if (!validation.valid) {
        this.logger.warn({ message: `Discount validation failed: ${code}`, error: validation.error });
        return this.createInvalidResult(code, validation.error!);
      }

      this.logger.info({ message: `Discount validated: ${code}`, amount: discount.value });
      return this.createValidResult(discount, subtotal);
    } catch (error) {
      this.logger.error({ message: `Error validating discount: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      return this.createInvalidResult(code, 'Error validating discount code');
    }
  }

  /**
   * Record a completed sale against the code's usage counter.
   * Called by checkout after payment succeeds — validation alone never burns usage.
   */
  async recordUsage(code: string): Promise<void> {
    try {
      await this.discountRepo.incrementUsageCount(code);
      this.logger.info({ message: `Discount usage recorded: ${code}` });
    } catch (error) {
      this.logger.error({ message: `Error recording discount usage: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getDiscountCodes(): Promise<DiscountCode[]> {
    try {
      const rows = await this.discountRepo.findAll();
      return rows.map(row => this.discountRepo.mapRowToDiscount(row));
    } catch (error) {
      this.logger.error({ message: 'Error fetching discount codes' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async createDiscountCode(discount: Omit<DiscountCode, 'usageCount'>): Promise<DiscountCode> {
    try {
      await this.discountRepo.create({
        code: discount.code,
        type: discount.type,
        value: discount.value,
        description: discount.description ?? null,
        minimum_purchase: discount.minimumPurchase ?? null,
        maximum_discount: discount.maximumDiscount ?? null,
        starts_at: discount.startsAt ? discount.startsAt.getTime() : null,
        expires_at: discount.expiresAt ? discount.expiresAt.getTime() : null,
        usage_limit: discount.usageLimit ?? null,
        active: discount.active ? 1 : 0,
      });

      this.logger.info({ message: `Discount code created: ${discount.code}` });
      return { ...discount, usageCount: 0 };
    } catch (error) {
      this.logger.error(
        { message: `Error creating discount code: ${discount.code}` },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async updateDiscountCode(code: string, updates: Partial<DiscountCode>): Promise<DiscountCode> {
    try {
      const updateRow: Partial<DiscountRow> = {};

      if (updates.type !== undefined) updateRow.type = updates.type;
      if (updates.value !== undefined) updateRow.value = updates.value;
      if (updates.description !== undefined) updateRow.description = updates.description ?? null;
      if (updates.minimumPurchase !== undefined) updateRow.minimum_purchase = updates.minimumPurchase ?? null;
      if (updates.maximumDiscount !== undefined) updateRow.maximum_discount = updates.maximumDiscount ?? null;
      if (updates.startsAt !== undefined) updateRow.starts_at = updates.startsAt ? updates.startsAt.getTime() : null;
      if (updates.expiresAt !== undefined) updateRow.expires_at = updates.expiresAt ? updates.expiresAt.getTime() : null;
      if (updates.usageLimit !== undefined) updateRow.usage_limit = updates.usageLimit ?? null;
      if (updates.active !== undefined) updateRow.active = updates.active ? 1 : 0;

      await this.discountRepo.update(code, updateRow);

      // Fetch updated discount
      const row = await this.discountRepo.findByCode(code);
      if (!row) {
        throw new Error(`Discount code not found after update: ${code}`);
      }

      this.logger.info({ message: `Discount code updated: ${code}` });
      return this.discountRepo.mapRowToDiscount(row);
    } catch (error) {
      this.logger.error({ message: `Error updating discount code: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async deleteDiscountCode(code: string): Promise<void> {
    try {
      await this.discountRepo.delete(code);
      this.logger.info({ message: `Discount code deleted: ${code}` });
    } catch (error) {
      this.logger.error({ message: `Error deleting discount code: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
