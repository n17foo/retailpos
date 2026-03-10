/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { COMMERCEFULL_API_VERSION } from '../../config/apiVersions';

/**
 * Configuration for the CommerceFull API client
 */
export interface CommerceFullConfig {
  storeUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  apiVersion?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Shared HTTP client for all CommerceFull platform services.
 * Handles authentication via token-based auth (access + refresh tokens).
 * All services share a single instance to reuse the auth session.
 */
export class CommerceFullApiClient {
  private static instance: CommerceFullApiClient;
  private config: CommerceFullConfig = {};
  private initialized = false;
  private accessToken: string | null = null;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullApiClient');

  private constructor() {}

  public static getInstance(): CommerceFullApiClient {
    if (!CommerceFullApiClient.instance) {
      CommerceFullApiClient.instance = new CommerceFullApiClient();
    }
    return CommerceFullApiClient.instance;
  }

  /**
   * Configure the client with platform credentials
   */
  public configure(config: CommerceFullConfig): void {
    this.config = { ...config };
    this.initialized = false;
    this.accessToken = null;
  }

  /**
   * Initialize the client: authenticate and obtain an access token
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn('Missing CommerceFull storeUrl');
        return false;
      }

      const baseUrl = this.normalizeUrl(this.config.storeUrl);
      this.config.storeUrl = baseUrl;

      // Try to get token from token service first
      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.COMMERCEFULL);

      if (tokenInitialized) {
        const token = await getPlatformToken(ECommercePlatform.COMMERCEFULL, TokenType.ACCESS);
        if (token) {
          this.accessToken = token;
          this.initialized = true;
          return true;
        }
      }

      // Fallback: authenticate directly using apiKey/apiSecret
      if (this.config.apiKey && this.config.apiSecret) {
        const tokenUrl = `${baseUrl}/business/auth/token`;
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.config.apiKey,
            password: this.config.apiSecret,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          this.accessToken = data.accessToken || data.token;
          this.initialized = true;
          return true;
        }

        const errText = await response.text();
        this.logger.error({ message: 'CommerceFull auth failed' }, new Error(`Status ${response.status}: ${errText}`));
        return false;
      }

      // If we have a direct accessToken in config, use it
      if (this.config.apiKey && !this.config.apiSecret) {
        this.accessToken = this.config.apiKey as string;
        this.initialized = true;
        return true;
      }

      this.logger.warn('No credentials provided for CommerceFull');
      return false;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize CommerceFull API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getBaseUrl(): string {
    return this.config.storeUrl || '';
  }

  public getApiVersion(): string {
    return (this.config.apiVersion as string) || COMMERCEFULL_API_VERSION;
  }

  /**
   * Make an authenticated GET request
   */
  public async get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(path, params);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Make an authenticated POST request
   */
  public async post<T = any>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Make an authenticated PUT request
   */
  public async put<T = any>(path: string, body?: unknown): Promise<T> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  /**
   * Make an authenticated DELETE request
   */
  public async delete<T = any>(path: string): Promise<T> {
    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = `${this.config.storeUrl}${path}`;
    if (!params || Object.keys(params).length === 0) return base;
    const qs = new URLSearchParams(params).toString();
    return `${base}?${qs}`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CommerceFull API error ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }
}
