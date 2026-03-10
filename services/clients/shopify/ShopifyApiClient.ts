import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { SHOPIFY_API_VERSION } from '../../config/apiVersions';

/**
 * Shopify-specific API client configuration.
 */
export interface ShopifyConfig extends BaseApiClientConfig {
  storeUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all Shopify platform services.
 *
 * Centralises authentication (X-Shopify-Access-Token), URL building
 * (`/admin/api/{version}/...`), and URL normalisation so that
 * individual Shopify*Service files no longer duplicate this logic.
 */
export class ShopifyApiClient extends BaseApiClient<ShopifyConfig> {
  private static instance: ShopifyApiClient;
  private accessToken: string | null = null;

  private constructor() {
    super('ShopifyApiClient');
  }

  public static getInstance(): ShopifyApiClient {
    if (!ShopifyApiClient.instance) {
      ShopifyApiClient.instance = new ShopifyApiClient();
    }
    return ShopifyApiClient.instance;
  }

  /**
   * Configure and authenticate with Shopify.
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing Shopify storeUrl' });
        return false;
      }

      this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);
      this.config.apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;

      // Try token service first
      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SHOPIFY);

      if (tokenInitialized) {
        const token = await getPlatformToken(ECommercePlatform.SHOPIFY, TokenType.ACCESS);
        if (token) {
          this.accessToken = token;
          this.initialized = true;
          return true;
        }
      }

      // Fallback to config accessToken
      if (this.config.accessToken) {
        this.accessToken = this.config.accessToken;
        this.initialized = true;
        return true;
      }

      // Fallback to apiKey as token
      if (this.config.apiKey) {
        this.accessToken = this.config.apiKey;
        this.initialized = true;
        return true;
      }

      this.logger.warn({ message: 'No Shopify credentials available' });
      return false;
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize Shopify API client' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || SHOPIFY_API_VERSION;
  }

  // ── BaseApiClient contract ─────────────────────────────────────────

  protected getAuthStrategy(): AuthStrategy {
    if (!this.accessToken) return { type: 'none' };
    return {
      type: 'header',
      headers: { 'X-Shopify-Access-Token': this.accessToken },
    };
  }

  protected buildApiUrl(path: string): string {
    const version = this.getApiVersion();
    const base = this.config.storeUrl || '';
    // If path already starts with /admin, don't double-prefix
    if (path.startsWith('/admin')) {
      return `${base}${path}`;
    }
    // Strip leading slash for clean join
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${base}/admin/api/${version}/${cleanPath}`;
  }
}
