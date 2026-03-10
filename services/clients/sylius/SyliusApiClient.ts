import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { SYLIUS_API_VERSION } from '../../config/apiVersions';

/**
 * Sylius-specific API client configuration.
 */
export interface SyliusConfig extends BaseApiClientConfig {
  storeUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all Sylius platform services.
 *
 * Centralises Bearer token (OAuth) header injection and URL building
 * (`${storeUrl}/api/${version}/...`), so that individual
 * Sylius*Service files no longer duplicate this logic.
 */
export class SyliusApiClient extends BaseApiClient<SyliusConfig> {
  private static instance: SyliusApiClient;

  private constructor() {
    super('SyliusApiClient');
  }

  public static getInstance(): SyliusApiClient {
    if (!SyliusApiClient.instance) {
      SyliusApiClient.instance = new SyliusApiClient();
    }
    return SyliusApiClient.instance;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn({ message: 'Missing Sylius storeUrl' });
        return false;
      }

      this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);
      this.config.apiVersion = this.config.apiVersion || SYLIUS_API_VERSION;

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize Sylius API client' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || SYLIUS_API_VERSION;
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
    return `${base}/api/${version}/${cleanPath}`;
  }
}
