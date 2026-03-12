import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { MAGENTO_API_VERSION } from '../../config/apiVersions';

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

  protected getAuthStrategy(): AuthStrategy {
    if (this.config.accessToken) {
      return { type: 'bearer', token: this.config.accessToken };
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
    return `${base}/rest/${version}/${cleanPath}`;
  }

  /**
   * Authenticate with Magento admin credentials and return an access token.
   * Uses the unauthenticated token endpoint directly.
   */
  public async fetchAdminToken(apiUrl: string, username: string, password: string): Promise<string> {
    const url = `${this.normalizeUrl(apiUrl)}/rest/V1/integration/admin/token`;
    const token = await this.request<string>('POST', url, { username, password });
    if (typeof token !== 'string') {
      throw new Error('Invalid token response from Magento API');
    }
    return token;
  }
}
