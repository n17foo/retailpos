import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { MAGENTO_API_VERSION } from '../../config/apiVersions';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';

/**
 * Magento-specific API client configuration.
 */
export interface MagentoConfig extends BaseApiClientConfig {
  storeUrl?: string;
  accessToken?: string;
  username?: string;
  password?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all Magento platform services.
 *
 * Centralises Bearer token header injection and URL building
 * (`${storeUrl}/rest/${version}/...`), so that individual
 * Magento*Service files no longer duplicate this logic.
 */
export class MagentoApiClient extends BaseApiClient<MagentoConfig> {
  private static instance: MagentoApiClient;

  private constructor() {
    super('MagentoApiClient');
  }

  public static getInstance(): MagentoApiClient {
    if (!MagentoApiClient.instance) {
      MagentoApiClient.instance = new MagentoApiClient();
    }
    return MagentoApiClient.instance;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing Magento storeUrl' });
        return false;
      }

      this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);
      this.config.apiVersion = this.config.apiVersion || MAGENTO_API_VERSION;

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize Magento API client' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || MAGENTO_API_VERSION;
  }

  protected async getAuthStrategy(): Promise<AuthStrategy> {
    const token = (await getPlatformToken(ECommercePlatform.MAGENTO, TokenType.ACCESS)) || this.config.accessToken;
    return token ? { type: 'bearer', token } : { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    const base = this.config.storeUrl || '';
    const version = this.getApiVersion();
    if (path.startsWith('http')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${base}/rest/${version}/${cleanPath}`;
  }

  /**
   * Authenticate with Magento admin credentials and return an access token.
   * Uses the unauthenticated token endpoint via a raw fetch — deliberately
   * not routed through `request()` so token acquisition never depends on
   * (or recursively triggers) `getAuthStrategy()`.
   */
  public async fetchAdminToken(apiUrl: string, username: string, password: string): Promise<string> {
    const url = `${this.normalizeUrl(apiUrl)}/rest/V1/integration/admin/token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw new Error(`Magento token request failed: ${response.status}`);
    }
    const token = (await response.json()) as unknown;
    if (typeof token !== 'string') {
      throw new Error('Invalid token response from Magento API');
    }
    return token;
  }
}
