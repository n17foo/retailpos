import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { WOOCOMMERCE_API_VERSION } from '../../config/apiVersions';

/**
 * WooCommerce-specific API client configuration.
 */
export interface WooCommerceConfig extends BaseApiClientConfig {
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all WooCommerce platform services.
 *
 * Centralises Basic Auth (consumer_key:consumer_secret), URL building
 * (`/wp-json/wc/v3/...`), and URL normalisation so that
 * individual WooCommerce*Service files no longer duplicate this logic.
 */
export class WooCommerceApiClient extends BaseApiClient<WooCommerceConfig> {
  private static instance: WooCommerceApiClient;

  private constructor() {
    super('WooCommerceApiClient');
  }

  public static getInstance(): WooCommerceApiClient {
    if (!WooCommerceApiClient.instance) {
      WooCommerceApiClient.instance = new WooCommerceApiClient();
    }
    return WooCommerceApiClient.instance;
  }

  /**
   * Configure and validate the WooCommerce connection.
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing WooCommerce storeUrl' });
        return false;
      }

      if (!this.config.consumerKey || !this.config.consumerSecret) {
        this.logger.warn({ message: 'Missing WooCommerce consumer key/secret' });
        return false;
      }

      this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);
      this.config.apiVersion = this.config.apiVersion || WOOCOMMERCE_API_VERSION;

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize WooCommerce API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || WOOCOMMERCE_API_VERSION;
  }

  // ── BaseApiClient contract ─────────────────────────────────────────

  protected getAuthStrategy(): AuthStrategy {
    if (!this.config.consumerKey || !this.config.consumerSecret) {
      return { type: 'none' };
    }
    return {
      type: 'basic',
      username: this.config.consumerKey,
      password: this.config.consumerSecret,
    };
  }

  protected buildApiUrl(path: string): string {
    const version = this.getApiVersion();
    const base = this.config.storeUrl || '';
    // If path already starts with /wp-json, don't double-prefix
    if (path.startsWith('/wp-json')) {
      return `${base}${path}`;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${base}/wp-json/${version}/${cleanPath}`;
  }
}
