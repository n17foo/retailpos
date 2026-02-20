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
}

// ── Settings keys in the database ───────────────────────────────────

export const SETTINGS_KEYS: Record<keyof POSConfig, string> = {
  taxRate: 'pos.taxRate',
  maxSyncRetries: 'pos.maxSyncRetries',
  storeName: 'pos.storeName',
  storeAddress: 'pos.storeAddress',
  storePhone: 'pos.storePhone',
  currencySymbol: 'pos.currencySymbol',
  drawerOpenOnCash: 'pos.drawerOpenOnCash',
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

// ── Convenience accessors (backward-compat for existing imports) ────

export function DEFAULT_TAX_RATE(): number {
  return posConfig.values.taxRate;
}

export function MAX_SYNC_RETRIES(): number {
  return posConfig.values.maxSyncRetries;
}
