import { keyValueRepository } from '../../repositories/KeyValueRepository';
import { LoggerFactory } from '../logger/loggerFactory';

export type LocalApiMode = 'standalone' | 'server' | 'client';

export interface LocalApiSettings {
  mode: LocalApiMode;
  serverAddress: string;
  port: number;
  sharedSecret: string;
  registerId: string;
  registerName: string;
}

const DEFAULTS: LocalApiSettings = {
  mode: 'standalone',
  serverAddress: '',
  port: 8787,
  sharedSecret: '',
  registerId: '',
  registerName: 'Register 1',
};

const KV_KEY = 'localapi.settings';

/**
 * Configuration for the local shared API.
 * - **standalone**: single register, no networking (default)
 * - **server**: this device runs the HTTP server; other registers connect to it
 * - **client**: this device connects to a server register over the LAN
 */
export class LocalApiConfig {
  private static instance: LocalApiConfig;
  private settings: LocalApiSettings = { ...DEFAULTS };
  private loaded = false;
  private logger = LoggerFactory.getInstance().createLogger('LocalApiConfig');

  private constructor() {}

  static getInstance(): LocalApiConfig {
    if (!LocalApiConfig.instance) {
      LocalApiConfig.instance = new LocalApiConfig();
    }
    return LocalApiConfig.instance;
  }

  async load(): Promise<LocalApiSettings> {
    try {
      const raw = await keyValueRepository.getItem(KV_KEY);
      if (raw) {
        this.settings = { ...DEFAULTS, ...JSON.parse(raw) };
      }
      this.loaded = true;
    } catch (error) {
      this.logger.error({ message: 'Failed to load local API config' }, error instanceof Error ? error : new Error(String(error)));
    }
    return this.settings;
  }

  async save(updates: Partial<LocalApiSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await keyValueRepository.setItem(KV_KEY, JSON.stringify(this.settings));
  }

  get current(): LocalApiSettings {
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

export const localApiConfig = LocalApiConfig.getInstance();
