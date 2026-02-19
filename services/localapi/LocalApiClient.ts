import { localApiConfig } from './LocalApiConfig';
import { LoggerFactory } from '../logger/loggerFactory';

/**
 * HTTP client for connecting to a Local API Server on the LAN.
 * Used by registers in "client" mode to read/write shared data
 * from the server register instead of local SQLite.
 */
export class LocalApiClient {
  private static instance: LocalApiClient;
  private logger = LoggerFactory.getInstance().createLogger('LocalApiClient');
  private connected = false;

  private constructor() {}

  static getInstance(): LocalApiClient {
    if (!LocalApiClient.instance) {
      LocalApiClient.instance = new LocalApiClient();
    }
    return LocalApiClient.instance;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** Test the connection to the server */
  async testConnection(): Promise<{ ok: boolean; registerName?: string; error?: string }> {
    try {
      const result = await this.get<{ ok: boolean; registerId: string; registerName: string }>('/api/health');
      this.connected = result.ok === true;
      return { ok: true, registerName: result.registerName };
    } catch (error) {
      this.connected = false;
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ── Orders ────────────────────────────────────────────────────────

  async getOrders(status?: string): Promise<any[]> {
    const result = await this.get<{ orders: any[] }>('/api/orders', status ? { status } : undefined);
    return result.orders;
  }

  async getOrder(orderId: string): Promise<{ order: any; items: any[] } | null> {
    try {
      return await this.get<{ order: any; items: any[] }>(`/api/orders/${orderId}`);
    } catch {
      return null;
    }
  }

  async getUnsyncedOrders(): Promise<any[]> {
    const result = await this.get<{ orders: any[] }>('/api/orders/unsynced');
    return result.orders;
  }

  // ── Products ──────────────────────────────────────────────────────

  async getProducts(): Promise<any[]> {
    const result = await this.get<{ products: any[] }>('/api/products');
    return result.products;
  }

  async getProduct(productId: string): Promise<any | null> {
    try {
      const result = await this.get<{ product: any }>(`/api/products/${productId}`);
      return result.product;
    } catch {
      return null;
    }
  }

  // ── Tax Profiles ──────────────────────────────────────────────────

  async getTaxProfiles(): Promise<any[]> {
    const result = await this.get<{ taxProfiles: any[] }>('/api/tax-profiles');
    return result.taxProfiles;
  }

  // ── Returns ───────────────────────────────────────────────────────

  async getReturns(status?: string): Promise<any[]> {
    const result = await this.get<{ returns: any[] }>('/api/returns', status ? { status } : undefined);
    return result.returns;
  }

  async getReturnsByOrder(orderId: string): Promise<any[]> {
    const result = await this.get<{ returns: any[] }>(`/api/returns/order/${orderId}`);
    return result.returns;
  }

  // ── Generic HTTP helpers ──────────────────────────────────────────

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Register-Id': localApiConfig.current.registerId,
    };
    const secret = localApiConfig.current.sharedSecret;
    if (secret) {
      h['x-shared-secret'] = secret;
    }
    return h;
  }

  private get baseUrl(): string {
    return localApiConfig.baseUrl;
  }

  private async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      url += `?${qs}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `GET ${path} failed: ${response.status}`);
    }

    return response.json();
  }

  private async post<T>(path: string, body: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `POST ${path} failed: ${response.status}`);
    }

    return response.json();
  }

  private async put<T>(path: string, body: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `PUT ${path} failed: ${response.status}`);
    }

    return response.json();
  }
}

export const localApiClient = LocalApiClient.getInstance();
