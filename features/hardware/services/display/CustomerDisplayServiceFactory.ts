import { CustomerDisplayServiceInterface, DisplayConnectionConfig } from './CustomerDisplayServiceInterface';
import { NoOpDisplayService } from './NoOpDisplayService';
import { WebSocketDisplayService } from './WebSocketDisplayService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';

export type DisplayType = 'websocket' | 'none';

const DISPLAY_SETTINGS_KEY = 'customerDisplaySettings';

export interface CustomerDisplaySettings {
  enabled: boolean;
  type: DisplayType;
  endpoint: string;
  idleMessage?: string;
  thankYouMessage?: string;
}

const DEFAULT_DISPLAY_SETTINGS: CustomerDisplaySettings = {
  enabled: false,
  type: 'none',
  endpoint: '',
  idleMessage: 'Welcome!',
  thankYouMessage: 'Thank you!',
};

/**
 * Factory for creating and managing the customer-facing display service.
 *
 * Usage:
 *   const display = CustomerDisplayServiceFactory.getInstance().getService();
 *   await display.update(buildDisplayState(items, subtotal, tax, total, currency));
 */
export class CustomerDisplayServiceFactory {
  private static instance: CustomerDisplayServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('CustomerDisplayServiceFactory');
  private currentService: CustomerDisplayServiceInterface = new NoOpDisplayService();
  private settings: CustomerDisplaySettings = DEFAULT_DISPLAY_SETTINGS;

  private constructor() {}

  static getInstance(): CustomerDisplayServiceFactory {
    if (!CustomerDisplayServiceFactory.instance) {
      CustomerDisplayServiceFactory.instance = new CustomerDisplayServiceFactory();
    }
    return CustomerDisplayServiceFactory.instance;
  }

  /**
   * Load display settings from storage and connect if enabled.
   * Call once at app startup.
   */
  async initialize(): Promise<void> {
    try {
      const saved = await keyValueRepository.getObject<CustomerDisplaySettings>(DISPLAY_SETTINGS_KEY);
      if (saved) this.settings = { ...DEFAULT_DISPLAY_SETTINGS, ...saved };

      if (this.settings.enabled && this.settings.type !== 'none') {
        await this.applySettings(this.settings);
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize customer display' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Get the active display service (NoOp if not configured). */
  getService(): CustomerDisplayServiceInterface {
    return this.currentService;
  }

  /** Get the current settings (for the settings UI). */
  getSettings(): CustomerDisplaySettings {
    return { ...this.settings };
  }

  /** Configure and connect to a display. Persists settings to storage. */
  async configure(settings: CustomerDisplaySettings): Promise<boolean> {
    this.settings = settings;
    await keyValueRepository.setObject(DISPLAY_SETTINGS_KEY, settings);
    return this.applySettings(settings);
  }

  /** Disconnect and reset to no-op. */
  async reset(): Promise<void> {
    await this.currentService.disconnect();
    this.currentService = new NoOpDisplayService();
  }

  private async applySettings(settings: CustomerDisplaySettings): Promise<boolean> {
    await this.currentService.disconnect();

    if (!settings.enabled || settings.type === 'none') {
      this.currentService = new NoOpDisplayService();
      return true;
    }

    const config: DisplayConnectionConfig = {
      endpoint: settings.endpoint,
    };

    switch (settings.type) {
      case 'websocket':
        this.currentService = new WebSocketDisplayService();
        break;
      default:
        // Stale persisted value (e.g. a removed driver type) — fall back safely
        this.logger.warn({ message: `Unknown display type '${settings.type}', using no-op` });
        this.currentService = new NoOpDisplayService();
        return true;
    }

    const connected = await this.currentService.connect(config);
    if (!connected) {
      this.logger.warn({ message: `Failed to connect customer display at ${settings.endpoint}` });
    }
    return connected;
  }
}

export const customerDisplayServiceFactory = CustomerDisplayServiceFactory.getInstance();
