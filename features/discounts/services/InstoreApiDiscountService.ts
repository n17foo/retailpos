import { BaseDiscountService } from './BaseDiscountService';
import { DiscountValidationResult, DiscountCode } from './DiscountServiceInterface';
import { DiscountRow } from '../repositories/DiscountRepository';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';

/**
 * Store API-backed discount service for multi-register deployments.
 *
 * Discount definitions and usage counts live on the Store API so a
 * single-use code can't burn once per till. `recordUsage` hits the server's
 * atomic redeem endpoint — 409 when the usage limit is already exhausted.
 */
export class InstoreApiDiscountService extends BaseDiscountService {
  constructor() {
    super('InstoreApiDiscountService');
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async validateDiscount(code: string, subtotal: number): Promise<DiscountValidationResult> {
    try {
      const row = (await instoreApiClient.getDiscountByCode(code)) as DiscountRow | null;
      if (!row) {
        this.logger.warn({ message: `Discount code not found: ${code}` });
        return this.createInvalidResult(code, 'Invalid discount code');
      }
      const discount = this.mapRowToDiscount(row);
      const validation = this.validateDiscountRules(discount, subtotal);
      if (!validation.valid) {
        this.logger.warn({ message: `Discount validation failed: ${code}`, error: validation.error });
        return this.createInvalidResult(code, validation.error!);
      }
      return this.createValidResult(discount, subtotal);
    } catch (error) {
      this.logger.error({ message: `Error validating discount: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      return this.createInvalidResult(code, 'Error validating discount code');
    }
  }

  /**
   * Atomically burns one usage on the server — fails closed when the limit
   * is already exhausted, so a single-use code can't be reused per register.
   */
  async recordUsage(code: string): Promise<void> {
    try {
      await instoreApiClient.redeemDiscount(code);
    } catch (error) {
      this.logger.error({ message: `Error recording discount usage: ${code}` }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getDiscountCodes(): Promise<DiscountCode[]> {
    try {
      const rows = (await instoreApiClient.getDiscounts()) as DiscountRow[];
      return rows.map(row => this.mapRowToDiscount(row));
    } catch (error) {
      this.logger.error({ message: 'Error fetching discount codes' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async createDiscountCode(discount: Omit<DiscountCode, 'usageCount'>): Promise<DiscountCode> {
    const row = (await instoreApiClient.upsertDiscount(this.toServerPayload(discount))) as DiscountRow;
    return this.mapRowToDiscount(row);
  }

  async updateDiscountCode(code: string, updates: Partial<DiscountCode>): Promise<DiscountCode> {
    // Server upsert replaces all fields — merge onto the existing row first.
    const existing = (await instoreApiClient.getDiscountByCode(code)) as DiscountRow | null;
    if (!existing) {
      throw new Error(`Discount code not found: ${code}`);
    }
    const merged: Omit<DiscountCode, 'usageCount'> = {
      code: existing.code,
      type: updates.type ?? existing.type,
      value: updates.value ?? existing.value,
      description: updates.description !== undefined ? updates.description : (existing.description ?? undefined),
      minimumPurchase: updates.minimumPurchase !== undefined ? updates.minimumPurchase : (existing.minimum_purchase ?? undefined),
      maximumDiscount: updates.maximumDiscount !== undefined ? updates.maximumDiscount : (existing.maximum_discount ?? undefined),
      startsAt: updates.startsAt !== undefined ? updates.startsAt : existing.starts_at ? new Date(existing.starts_at) : undefined,
      expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : existing.expires_at ? new Date(existing.expires_at) : undefined,
      usageLimit: updates.usageLimit !== undefined ? updates.usageLimit : (existing.usage_limit ?? undefined),
      active: updates.active ?? existing.active === 1,
    };
    const row = (await instoreApiClient.upsertDiscount(this.toServerPayload(merged))) as DiscountRow;
    return this.mapRowToDiscount(row);
  }

  async deleteDiscountCode(code: string): Promise<void> {
    await instoreApiClient.deleteDiscount(code);
  }

  private toServerPayload(discount: Omit<DiscountCode, 'usageCount'>): Record<string, unknown> {
    return {
      code: discount.code,
      type: discount.type,
      value: discount.value,
      description: discount.description ?? null,
      minimum_purchase: discount.minimumPurchase ?? null,
      maximum_discount: discount.maximumDiscount ?? null,
      starts_at: discount.startsAt ? discount.startsAt.getTime() : null,
      expires_at: discount.expiresAt ? discount.expiresAt.getTime() : null,
      usage_limit: discount.usageLimit ?? null,
      active: discount.active ?? true,
    };
  }

  /** Mirrors DiscountRepository.mapRowToDiscount for server rows. */
  private mapRowToDiscount(row: DiscountRow): DiscountCode {
    return {
      code: row.code,
      type: row.type,
      value: row.value,
      description: row.description ?? undefined,
      minimumPurchase: row.minimum_purchase ?? undefined,
      maximumDiscount: row.maximum_discount ?? undefined,
      startsAt: row.starts_at ? new Date(row.starts_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      usageLimit: row.usage_limit ?? undefined,
      usageCount: row.usage_count,
      active: row.active === 1,
    };
  }
}

export const instoreApiDiscountService = new InstoreApiDiscountService();
