import { BaseApiClient, AuthStrategy, BaseApiClientConfig } from '../BaseApiClient';

export interface StripeConfig extends BaseApiClientConfig {
  apiKey?: string;
  backendUrl?: string;
}

/**
 * HTTP client for the Stripe REST API and an optional POS backend proxy.
 * Uses Bearer token (secret key) authentication against api.stripe.com,
 * or plain JSON against a backend proxy URL when configured.
 */
export class StripeApiClient extends BaseApiClient<StripeConfig> {
  private static instance: StripeApiClient;

  private constructor() {
    super('StripeApiClient');
  }

  public static getInstance(): StripeApiClient {
    if (!StripeApiClient.instance) {
      StripeApiClient.instance = new StripeApiClient();
    }
    return StripeApiClient.instance;
  }

  public async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  protected getAuthStrategy(): AuthStrategy {
    if (this.config.apiKey) {
      return { type: 'bearer', token: this.config.apiKey };
    }
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    if (path.startsWith('http')) return path;
    const base = (this.config.storeUrl || 'https://api.stripe.com').replace(/\/$/, '');
    return `${base}/${path.replace(/^\//, '')}`;
  }

  /**
   * POST to the optional backend proxy URL.
   * Falls back to direct Stripe API if backendUrl is not set.
   */
  public async postToBackend<T>(backendPath: string, stripeFallbackPath: string, body: unknown): Promise<T> {
    if (this.config.backendUrl) {
      const url = `${this.config.backendUrl.replace(/\/$/, '')}/${backendPath.replace(/^\//, '')}`;
      return this.request<T>('POST', url, body);
    }
    return this.post<T>(stripeFallbackPath, body);
  }

  /**
   * GET from the optional backend proxy URL.
   * Falls back to direct Stripe API if backendUrl is not set.
   */
  public async getFromBackend<T>(backendPath: string, stripeFallbackPath: string): Promise<T> {
    if (this.config.backendUrl) {
      const url = `${this.config.backendUrl.replace(/\/$/, '')}/${backendPath.replace(/^\//, '')}`;
      return this.request<T>('GET', url);
    }
    return this.get<T>(stripeFallbackPath);
  }
}
