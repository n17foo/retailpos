import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { BIGCOMMERCE_API_VERSION } from '../../config/apiVersions';

/**
 * BigCommerce-specific API client configuration.
 */
export interface BigCommerceConfig extends BaseApiClientConfig {
  storeHash?: string;
  accessToken?: string;
  clientId?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all BigCommerce platform services.
 *
 * Centralises X-Auth-Token / X-Auth-Client header injection, URL building
 * (`https://api.bigcommerce.com/stores/{hash}/v3/...`), so that
 * individual BigCommerce*Service files no longer duplicate this logic.
 */
export class BigCommerceApiClient extends BaseApiClient<BigCommerceConfig> {
  private static instance: BigCommerceApiClient;

  private constructor() {
    super('BigCommerceApiClient');
  }

  public static getInstance(): BigCommerceApiClient {
    if (!BigCommerceApiClient.instance) {
      BigCommerceApiClient.instance = new BigCommerceApiClient();
    }
    return BigCommerceApiClient.instance;
  }

  /**
   * Configure and validate the BigCommerce connection.
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeHash) {
        this.logger.warn({ message: 'Missing BigCommerce storeHash' });
        return false;
      }

      if (!this.config.accessToken) {
        this.logger.warn({ message: 'Missing BigCommerce accessToken' });
        return false;
      }

      this.config.apiVersion = this.config.apiVersion || BIGCOMMERCE_API_VERSION;
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize BigCommerce API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || BIGCOMMERCE_API_VERSION;
  }

  public getStoreHash(): string {
    return this.config.storeHash || '';
  }

  // ── BaseApiClient contract ─────────────────────────────────────────

  protected getAuthStrategy(): AuthStrategy {
    const headers: Record<string, string> = {};
    if (this.config.accessToken) {
      headers['X-Auth-Token'] = this.config.accessToken;
    }
    if (this.config.clientId) {
      headers['X-Auth-Client'] = this.config.clientId;
    }
    return Object.keys(headers).length > 0 ? { type: 'header', headers } : { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    const storeHash = this.config.storeHash || '';
    const version = this.getApiVersion();
    // If path already contains the full BigCommerce API base, return as-is
    if (path.startsWith('https://')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://api.bigcommerce.com/stores/${storeHash}/${version}/${cleanPath}`;
  }
}
