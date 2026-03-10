import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { WIX_API_VERSION } from '../../config/apiVersions';

/**
 * Wix-specific API client configuration.
 */
export interface WixConfig extends BaseApiClientConfig {
  apiKey?: string;
  siteId?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all Wix platform services.
 *
 * Centralises API-key-based Authorization header injection and URL building
 * (`https://www.wixapis.com/${version}/...`), so that individual
 * Wix*Service files no longer duplicate this logic.
 */
export class WixApiClient extends BaseApiClient<WixConfig> {
  private static instance: WixApiClient;

  private constructor() {
    super('WixApiClient');
  }

  public static getInstance(): WixApiClient {
    if (!WixApiClient.instance) {
      WixApiClient.instance = new WixApiClient();
    }
    return WixApiClient.instance;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        this.logger.warn({ message: 'Missing Wix apiKey' });
        return false;
      }

      if (!this.config.siteId) {
        this.logger.warn({ message: 'Missing Wix siteId' });
        return false;
      }

      this.config.apiVersion = this.config.apiVersion || WIX_API_VERSION;

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize Wix API client' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || WIX_API_VERSION;
  }

  public getSiteId(): string {
    return this.config.siteId || '';
  }

  protected getAuthStrategy(): AuthStrategy {
    if (this.config.apiKey) {
      return {
        type: 'header',
        headers: {
          Authorization: this.config.apiKey,
          'wix-site-id': this.config.siteId || '',
        },
      };
    }
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://www.wixapis.com/${this.getApiVersion()}/${cleanPath}`;
  }
}
