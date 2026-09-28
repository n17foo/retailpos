import { db } from '../utils/db';
import { DiscountCode } from '../services/discount/DiscountServiceInterface';
import { buildUpdateAssignments } from '../utils/sql';

const DISCOUNT_UPDATE_COLUMNS = [
  'type',
  'value',
  'description',
  'minimum_purchase',
  'maximum_discount',
  'starts_at',
  'expires_at',
  'usage_limit',
  'usage_count',
  'active',
] as const;

export interface DiscountRow {
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  description: string | null;
  minimum_purchase: number | null;
  maximum_discount: number | null;
  starts_at: number | null; // timestamp
  expires_at: number | null; // timestamp
  usage_limit: number | null;
  usage_count: number;
  active: number; // 0 or 1
  created_at: number;
  updated_at: number;
}

export class DiscountRepository {
  async initialize(): Promise<void> {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS discounts (
        code TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('fixed', 'percentage')),
        value INTEGER NOT NULL,
        description TEXT,
        minimum_purchase INTEGER,
        maximum_discount INTEGER,
        starts_at INTEGER,
        expires_at INTEGER,
        usage_limit INTEGER,
        usage_count INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create index for active discounts
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_discounts_active 
      ON discounts(active, expires_at)
    `);
  }

  async findByCode(code: string): Promise<DiscountRow | null> {
    return db.getFirstAsync<DiscountRow>('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE', [code]);
  }

  async findAll(): Promise<DiscountRow[]> {
    return db.getAllAsync<DiscountRow>('SELECT * FROM discounts ORDER BY created_at DESC');
  }

  async findActive(): Promise<DiscountRow[]> {
    const now = Date.now();
    return db.getAllAsync<DiscountRow>(
      `SELECT * FROM discounts 
       WHERE active = 1 
       AND (starts_at IS NULL OR starts_at <= ?)
       AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY created_at DESC`,
      [now, now]
    );
  }

  async create(discount: Omit<DiscountRow, 'usage_count' | 'created_at' | 'updated_at'>): Promise<void> {
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO discounts (
        code, type, value, description, minimum_purchase, maximum_discount,
        starts_at, expires_at, usage_limit, usage_count, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        discount.code,
        discount.type,
        discount.value,
        discount.description,
        discount.minimum_purchase,
        discount.maximum_discount,
        discount.starts_at,
        discount.expires_at,
        discount.usage_limit,
        discount.active,
        now,
        now,
      ]
    );
  }

  async update(code: string, updates: Partial<Omit<DiscountRow, 'code' | 'created_at'>>): Promise<void> {
    const { assignments, values } = buildUpdateAssignments(updates, DISCOUNT_UPDATE_COLUMNS, ['code', 'created_at', 'updated_at']);
    if (assignments.length === 0) {
      return;
    }

    await db.runAsync(`UPDATE discounts SET ${assignments.join(', ')}, updated_at = ? WHERE code = ?`, [...values, Date.now(), code]);
  }

  async incrementUsageCount(code: string): Promise<void> {
    await db.runAsync('UPDATE discounts SET usage_count = usage_count + 1, updated_at = ? WHERE code = ?', [Date.now(), code]);
  }

  async delete(code: string): Promise<void> {
    await db.runAsync('DELETE FROM discounts WHERE code = ?', [code]);
  }

  mapRowToDiscount(row: DiscountRow): DiscountCode {
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
