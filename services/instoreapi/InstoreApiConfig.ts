import { LoggerFactory } from '../logger/LoggerFactory';
import { ProtectedValueStore } from '../config/ProtectedValueStore';

export type InstoreApiMode = 'standalone' | 'server' | 'client';

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
 * Configuration for the local shared API.
 * - **standalone**: single register, no networking (default)
 * - **server**: this device runs the HTTP server; other registers connect to it
 * - **client**: this device connects to a server register over the LAN
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
        this.settings = { ...DEFAULTS, ...JSON.parse(raw) };
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

  get isServer(): boolean {
    return this.settings.mode === 'server';
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
    if (this.isServer) {
      return `http://localhost:${this.settings.port}`;
    }
    return `http://${this.settings.serverAddress}:${this.settings.port}`;
  }
}

export const instoreApiConfig = InstoreApiConfig.getInstance();
