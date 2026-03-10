import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { PRESTASHOP_API_VERSION } from '../../config/apiVersions';

/**
 * PrestaShop-specific API client configuration.
 */
export interface PrestaShopConfig extends BaseApiClientConfig {
  storeUrl?: string;
  apiKey?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all PrestaShop platform services.
 *
 * Centralises Basic Auth (API key as username, empty password) header
 * injection and URL building (`${storeUrl}/${apiVersion}/...`), so that
 * individual PrestaShop*Service files no longer duplicate this logic.
 */
export class PrestaShopApiClient extends BaseApiClient<PrestaShopConfig> {
  private static instance: PrestaShopApiClient;

  private constructor() {
    super('PrestaShopApiClient');
  }

  public static getInstance(): PrestaShopApiClient {
    if (!PrestaShopApiClient.instance) {
      PrestaShopApiClient.instance = new PrestaShopApiClient();
    }
    return PrestaShopApiClient.instance;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing PrestaShop storeUrl' });
        return false;
      }

      if (!this.config.apiKey) {
        this.logger.warn({ message: 'Missing PrestaShop apiKey' });
        return false;
      }

      this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);
      this.config.apiVersion = this.config.apiVersion || PRESTASHOP_API_VERSION;

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize PrestaShop API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || PRESTASHOP_API_VERSION;
  }

  protected getAuthStrategy(): AuthStrategy {
    if (this.config.apiKey) {
      return {
        type: 'basic',
        username: this.config.apiKey,
        password: '',
      };
    }
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    const base = this.config.storeUrl || '';
    const version = this.getApiVersion();
    if (path.startsWith('http')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${base}/${version}/${cleanPath}`;
  }
}
