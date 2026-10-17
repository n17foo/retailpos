// ── Config shape ────────────────────────────────────────────────────

import { KeyValueRepository } from '../../repositories/KeyValueRepository';

export interface POSConfig {
  taxRate: number;
  maxSyncRetries: number;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  currencySymbol: string;
  drawerOpenOnCash: boolean;
  /** Idle minutes before the register locks and requires re-authentication. 0 disables. */
  autoLockMinutes?: number;
  // ── Sale screen (docs/specs/system/sales-screen-fast-path-ux.md §5.7) ──
  /** Tile density: 'large' | 'compact' | 'text' | 'auto' (default: auto-derived from catalogue images) */
  saleDensity?: 'large' | 'compact' | 'text' | 'auto';
  /** Input mode override: 'auto' | 'touch' | 'pointer' */
  saleInputMode?: 'auto' | 'touch' | 'pointer';
  /** Repeat-read de-dup window for scanners, ms (default 700) */
  saleScanDedupMs?: number;
  /** Enabled sale modes — the mode chip is hidden when a single mode is enabled */
  saleModes?: string[];
  /** One-tap line-note quick chips (empty = none shown) */
  saleNoteChips?: string[];
  /** Delay before the sale screen returns to a clean state after payment, ms (default 3000) */
  saleAutoNewSaleDelayMs?: number;
  /** Order total at or above which manager approval is required (absent = no gate) */
  checkoutHighValueThreshold?: number;
}

/** Security default applied until an admin configures autoLockMinutes. */
export const DEFAULT_AUTO_LOCK_MINUTES = 5;

// ── Settings keys in the database ───────────────────────────────────

export const SETTINGS_KEYS: Record<keyof POSConfig, string> = {
  autoLockMinutes: 'pos.autoLockMinutes',
  taxRate: 'pos.taxRate',
  maxSyncRetries: 'pos.maxSyncRetries',
  storeName: 'pos.storeName',
  storeAddress: 'pos.storeAddress',
  storePhone: 'pos.storePhone',
  currencySymbol: 'pos.currencySymbol',
  drawerOpenOnCash: 'pos.drawerOpenOnCash',
  saleDensity: 'sale.density',
  saleInputMode: 'sale.inputMode',
  saleScanDedupMs: 'sale.scanDedupMs',
  saleModes: 'sale.modes',
  saleNoteChips: 'sale.noteChips',
  saleAutoNewSaleDelayMs: 'sale.autoNewSaleDelayMs',
  checkoutHighValueThreshold: 'checkout.highValueThreshold',
};

/**
 * Required fields that must be configured during onboarding
 * before the app can function correctly.
 */
export const REQUIRED_FIELDS: (keyof POSConfig)[] = ['taxRate', 'storeName', 'currencySymbol'];

/**
 * Runtime POS configuration service.
 *
 * - No built-in defaults — every value must be explicitly set during
 *   onboarding or via the Settings screen.
 * - `load()` reads persisted values from SettingsRepository.
 * - `update()` persists a single field immediately.
 * - `isConfigured` returns false until every required field has a value.
 * - Services read values synchronously via `values`.
 */
export class POSConfigService {
  private static instance: POSConfigService;
  private config: Partial<POSConfig> = {};
  private loaded = false;

  constructor(private settingsRepo: KeyValueRepository) {}

  static getInstance(): POSConfigService {
    if (!POSConfigService.instance) {
      POSConfigService.instance = new POSConfigService(new KeyValueRepository());
    }
    return POSConfigService.instance;
  }

  /** Reset the singleton (used by tests). */
  static resetInstance(): void {
    POSConfigService.instance = undefined as unknown as POSConfigService;
  }

  /** Load all POS settings from the database. Call once at app startup. */
  async load(): Promise<void> {
    for (const [field, key] of Object.entries(SETTINGS_KEYS)) {
      const stored = await this.settingsRepo.getObject<POSConfig[keyof POSConfig]>(key);
      if (stored !== null && stored !== undefined) {
        (this.config as Record<string, unknown>)[field] = stored;
      }
    }
    this.loaded = true;
  }

  /** Update a single config value (persists to DB immediately). */
  async update<K extends keyof POSConfig>(field: K, value: POSConfig[K]): Promise<void> {
    (this.config as Record<string, unknown>)[field as string] = value;
    await this.settingsRepo.setObject(SETTINGS_KEYS[field], value);
  }

  /** Bulk-update multiple config values in one call. */
  async updateAll(values: Partial<POSConfig>): Promise<void> {
    for (const [field, value] of Object.entries(values)) {
      if (value !== undefined) {
        await this.update(field as keyof POSConfig, value as POSConfig[keyof POSConfig]);
      }
    }
  }

  /**
   * Current config values.
   * Throws if a required field is accessed before being configured.
   */
  get values(): Readonly<POSConfig> {
    return this.config as POSConfig;
  }

  /** Check whether all required fields have been set. */
  get isConfigured(): boolean {
    return REQUIRED_FIELDS.every(f => this.config[f] !== undefined && this.config[f] !== null);
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Return the list of required fields that are still missing. */
  getMissingFields(): (keyof POSConfig)[] {
    return REQUIRED_FIELDS.filter(f => this.config[f] === undefined || this.config[f] === null);
  }
}

export const posConfig = POSConfigService.getInstance();

/** Effective auto-lock timeout in milliseconds (0 = disabled). */
export function AUTO_LOCK_TIMEOUT_MS(): number {
  const minutes = posConfig.values.autoLockMinutes;
  const effective = typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0 ? minutes : DEFAULT_AUTO_LOCK_MINUTES;
  return effective * 60_000;
}

export function MAX_SYNC_RETRIES(): number {
  return posConfig.values.maxSyncRetries;
}
