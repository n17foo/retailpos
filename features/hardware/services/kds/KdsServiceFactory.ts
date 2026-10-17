import { KdsServiceInterface, KdsConnectionConfig } from './KdsServiceInterface';
import { NoOpKdsService } from './NoOpKdsService';
import { HttpKdsService } from './HttpKdsService';
import { RetryingKdsService } from './RetryingKdsService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { KdsVendorType, KDS_VENDOR_PRESETS } from './KdsVendorPresets';

export type KdsType = 'http' | 'websocket' | 'electron' | 'none';

const KDS_SETTINGS_KEY = 'kdsSettings';

export interface KdsSettings {
  enabled: boolean;
  type: KdsType;
  vendor: KdsVendorType;
  endpoint: string;
  apiKey: string;
  autoReconnect: boolean;
  pollIntervalMs: number;
  merchantId?: string; // For Clover and other multi-tenant KDS systems
}

const DEFAULT_KDS_SETTINGS: KdsSettings = {
  enabled: false,
  type: 'none',
  vendor: 'custom',
  endpoint: '',
  apiKey: '',
  autoReconnect: true,
  pollIntervalMs: 3000,
};

/**
 * Factory for creating and managing the Kitchen Display System service.
 *
 * Usage:
 *   const kds = KdsServiceFactory.getInstance().getService();
 *   await kds.sendOrder(ticket);
 */
export class KdsServiceFactory {
  private static instance: KdsServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('KdsServiceFactory');
  private currentService: KdsServiceInterface = new NoOpKdsService();
  private settings: KdsSettings = DEFAULT_KDS_SETTINGS;

  private constructor() {}

  static getInstance(): KdsServiceFactory {
    if (!KdsServiceFactory.instance) {
      KdsServiceFactory.instance = new KdsServiceFactory();
    }
    return KdsServiceFactory.instance;
  }

  /**
   * Load KDS settings from storage and connect if enabled.
   * Call once at app startup.
   */
  async initialize(): Promise<void> {
    try {
      const saved = await keyValueRepository.getObject<KdsSettings>(KDS_SETTINGS_KEY);
      if (saved) this.settings = { ...DEFAULT_KDS_SETTINGS, ...saved };

      if (this.settings.enabled && this.settings.type !== 'none') {
        await this.applySettings(this.settings);
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize KDS' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get the active KDS service (NoOp if not configured).
   */
  getService(): KdsServiceInterface {
    return this.currentService;
  }

  /** Get the current settings (for the settings UI). */
  getSettings(): KdsSettings {
    return { ...this.settings };
  }

  /**
   * Configure and connect to a KDS. Persists settings to storage.
   */
  async configure(settings: KdsSettings): Promise<boolean> {
    this.settings = settings;
    await keyValueRepository.setObject(KDS_SETTINGS_KEY, settings);
    return this.applySettings(settings);
  }

  /**
   * Disconnect and reset to no-op.
   */
  async reset(): Promise<void> {
    await this.currentService.disconnect();
    this.currentService = new NoOpKdsService();
  }

  private async applySettings(settings: KdsSettings): Promise<boolean> {
    await this.currentService.disconnect();

    if (!settings.enabled || settings.type === 'none') {
      this.currentService = new NoOpKdsService();
      return true;
    }

    const vendorPreset = KDS_VENDOR_PRESETS[settings.vendor];

    const config: KdsConnectionConfig = {
      endpoint: settings.endpoint,
      apiKey: settings.apiKey,
      autoReconnect: settings.autoReconnect,
      pollIntervalMs: settings.pollIntervalMs || vendorPreset.defaultPollIntervalMs,
      vendorPreset: vendorPreset,
      merchantId: settings.merchantId,
    };

    switch (settings.type) {
      case 'http':
        // Wrap so failed tickets persist and replay instead of being lost
        this.currentService = new RetryingKdsService(new HttpKdsService());
        break;
      default:
        this.logger.warn({ message: `KDS type '${settings.type}' not yet implemented, using no-op` });
        this.currentService = new NoOpKdsService();
        return true;
    }

    const connected = await this.currentService.connect(config);
    if (!connected) {
      this.logger.warn({ message: `Failed to connect to KDS at ${settings.endpoint}` });
    }
    return connected;
  }
}

export const kdsServiceFactory = KdsServiceFactory.getInstance();
