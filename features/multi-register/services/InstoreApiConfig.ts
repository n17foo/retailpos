import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { ProtectedValueStore } from '../../platform-clients/services/config/ProtectedValueStore';

export type InstoreApiMode = 'standalone' | 'client';

export interface InstoreApiSettings {
  mode: InstoreApiMode;
  serverAddress: string;
  port: number;
  sharedSecret: string;
  registerId: string;
  registerName: string;
}

const DEFAULTS: InstoreApiSettings = {
  mode: 'standalone',
  serverAddress: '',
  port: 8787,
  sharedSecret: '',
  registerId: '',
  registerName: 'Register 1',
};

const settingsStore = new ProtectedValueStore({
  kvKey: 'instoreapi.settings',
  secretKey: 'config:instoreapi.settings',
  storageModeKey: 'instoreapi.settings.storageMode',
  logContext: 'InstoreApiConfigStorage',
});

/**
 * Configuration for the in-store API connection.
 * - **standalone**: single register, no networking (default)
 * - **client**: this register connects to the dedicated in-store server over
 *   the LAN. The server is a separate project on its own host (ADR-018) —
 *   registers never host the API.
 */
export class InstoreApiConfig {
  private static instance: InstoreApiConfig;
  private settings: InstoreApiSettings = { ...DEFAULTS };
  private loaded = false;
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiConfig');

  private constructor() {}

  static getInstance(): InstoreApiConfig {
    if (!InstoreApiConfig.instance) {
      InstoreApiConfig.instance = new InstoreApiConfig();
    }
    return InstoreApiConfig.instance;
  }

  async load(): Promise<InstoreApiSettings> {
    try {
      const raw = await settingsStore.load();
      if (raw) {
        const stored = { ...DEFAULTS, ...(JSON.parse(raw) as InstoreApiSettings) };
        // Server mode was removed in ADR-018 — a register that used to host
        // falls back to standalone until it is re-pointed at the server.
        if ((stored.mode as string) === 'server') {
          stored.mode = 'standalone';
        }
        this.settings = stored;
      }
      this.loaded = true;
    } catch (error) {
      this.logger.error({ message: 'Failed to load local API config' }, error instanceof Error ? error : new Error(String(error)));
    }
    return this.settings;
  }

  async save(updates: Partial<InstoreApiSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await settingsStore.save(JSON.stringify(this.settings));
  }

  get current(): InstoreApiSettings {
    return { ...this.settings };
  }

  get isClient(): boolean {
    return this.settings.mode === 'client';
  }

  get isStandalone(): boolean {
    return this.settings.mode === 'standalone';
  }

  get isMultiRegister(): boolean {
    return this.settings.mode !== 'standalone';
  }

  get baseUrl(): string {
    return `http://${this.settings.serverAddress}:${this.settings.port}`;
  }
}

export const instoreApiConfig = InstoreApiConfig.getInstance();
