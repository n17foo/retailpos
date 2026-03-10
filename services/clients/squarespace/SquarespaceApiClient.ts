import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';
import { SQUARESPACE_API_VERSION } from '../../config/apiVersions';

/**
 * Squarespace-specific API client configuration.
 */
export interface SquarespaceConfig extends BaseApiClientConfig {
  apiKey?: string;
  apiVersion?: string;
}

/**
 * Shared HTTP client for all Squarespace platform services.
 *
 * Centralises Bearer token header injection and URL building
 * (`https://api.squarespace.com/${version}/...`), so that individual
 * Squarespace*Service files no longer duplicate this logic.
 */
export class SquarespaceApiClient extends BaseApiClient<SquarespaceConfig> {
  private static instance: SquarespaceApiClient;

  private constructor() {
    super('SquarespaceApiClient');
  }

  public static getInstance(): SquarespaceApiClient {
    if (!SquarespaceApiClient.instance) {
      SquarespaceApiClient.instance = new SquarespaceApiClient();
    }
    return SquarespaceApiClient.instance;
  }

  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        this.logger.warn({ message: 'Missing Squarespace apiKey' });
        return false;
      }

      this.config.apiVersion = this.config.apiVersion || SQUARESPACE_API_VERSION;

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public override getApiVersion(): string {
    return this.config.apiVersion || SQUARESPACE_API_VERSION;
  }

  protected getAuthStrategy(): AuthStrategy {
    if (this.config.apiKey) {
      return { type: 'bearer', token: this.config.apiKey };
    }
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    const version = this.getApiVersion();
    if (path.startsWith('http')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `https://api.squarespace.com/${version}/commerce/${cleanPath}`;
  }
}
