import { instoreApiConfig } from '../../instoreapi/InstoreApiConfig';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { OrderRow, CreateOrderInput } from '../../../repositories/OrderRepository';
import { OrderItemRow, CreateOrderItemInput } from '../../../repositories/OrderItemRepository';
import { Product } from '../../../repositories/ProductRepository';
import { TaxProfileRow } from '../../../repositories/TaxProfileRepository';
import { ReturnRow, CreateReturnInput } from '../../../repositories/ReturnRepository';
import { Category } from '../../../services/category/CategoryServiceInterface';

export interface InstoreApiHealthResponse {
  ok: boolean;
  registerId?: string;
  registerName?: string;
}

export interface InstoreApiSyncEventsResponse<TEvent> {
  events: TEvent[];
}

/**
 * HTTP client for connecting to a Local API Server on the LAN.
 * Used by registers in "client" mode to read/write shared data
 * from the server register instead of local SQLite.
 */
export class InstoreApiClient {
  private static instance: InstoreApiClient;
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiClient');
  private connected = false;

  private constructor() {}

  static getInstance(): InstoreApiClient {
    if (!InstoreApiClient.instance) {
      InstoreApiClient.instance = new InstoreApiClient();
    }
    return InstoreApiClient.instance;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** Test the connection to the server */
  async testConnection(): Promise<{ ok: boolean; registerName?: string; error?: string }> {
    try {
      const result = await this.get<InstoreApiHealthResponse>('/api/health');
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

  async probeHealth(baseUrl: string, secret?: string, timeoutMs: number = 2000): Promise<InstoreApiHealthResponse | null> {
    try {
      return await this.getFromBaseUrl<InstoreApiHealthResponse>(baseUrl, '/api/health', undefined, secret, timeoutMs);
    } catch {
      return null;
    }
  }

  async getSyncEvents<TEvent>(since: number): Promise<TEvent[]> {
    const result = await this.get<InstoreApiSyncEventsResponse<TEvent>>('/api/sync/events', { since: String(since) });
    return result.events || [];
  }

  // ── Orders ────────────────────────────────────────────────────────

  async getOrders(status?: string): Promise<OrderRow[]> {
    const result = await this.get<{ orders: OrderRow[] }>('/api/orders', status ? { status } : undefined);
    return result.orders;
  }

  async getOrder(orderId: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
    try {
      return await this.get<{ order: OrderRow; items: OrderItemRow[] }>(`/api/orders/${orderId}`);
    } catch {
      return null;
    }
  }

  async getUnsyncedOrders(): Promise<OrderRow[]> {
    const result = await this.get<{ orders: OrderRow[] }>('/api/orders/unsynced');
    return result.orders;
  }

  // ── Products ──────────────────────────────────────────────────────

  async getProducts(): Promise<Product[]> {
    const result = await this.get<{ products: Product[] }>('/api/products');
    return result.products;
  }

  async getProduct(productId: string): Promise<Product | null> {
    try {
      const result = await this.get<{ product: Product }>(`/api/products/${productId}`);
      return result.product;
    } catch {
      return null;
    }
  }

  // ── Tax Profiles ──────────────────────────────────────────────────

  async getTaxProfiles(): Promise<TaxProfileRow[]> {
    const result = await this.get<{ taxProfiles: TaxProfileRow[] }>('/api/tax-profiles');
    return result.taxProfiles;
  }

  // ── Returns ───────────────────────────────────────────────────────

  async getReturns(status?: string): Promise<ReturnRow[]> {
    const result = await this.get<{ returns: ReturnRow[] }>('/api/returns', status ? { status } : undefined);
    return result.returns;
  }

  async getReturnsByOrder(orderId: string): Promise<ReturnRow[]> {
    const result = await this.get<{ returns: ReturnRow[] }>(`/api/returns/order/${orderId}`);
    return result.returns;
  }

  // ── Categories ────────────────────────────────────────────────────

  async getCategories(): Promise<Category[]> {
    const result = await this.get<{ categories: Category[] }>('/api/categories');
    return result.categories;
  }

  async createCategory(data: Omit<Category, 'id'>): Promise<Category> {
    const result = await this.post<{ category: Category }>('/api/categories', data);
    return result.category;
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const result = await this.put<{ category: Category }>(`/api/categories/${id}`, data);
    return result.category;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.delete(`/api/categories/${id}`);
  }

  // ── Orders (write) ────────────────────────────────────────────────

  async createOrder(order: CreateOrderInput, items: CreateOrderItemInput[]): Promise<OrderRow> {
    const result = await this.post<{ order: OrderRow }>('/api/orders', { order, items });
    return result.order;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<OrderRow> {
    const result = await this.put<{ order: OrderRow }>(`/api/orders/${orderId}/status`, { status });
    return result.order;
  }

  async updateOrderPayment(orderId: string, paymentMethod: string, transactionId?: string): Promise<OrderRow> {
    const result = await this.put<{ order: OrderRow }>(`/api/orders/${orderId}/payment`, { paymentMethod, transactionId });
    return result.order;
  }

  // ── Products (write) ──────────────────────────────────────────────

  async createProduct(data: Omit<Product, 'id'>): Promise<Product> {
    const result = await this.post<{ product: Product }>('/api/products', data);
    return result.product;
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const result = await this.put<{ product: Product }>(`/api/products/${id}`, data);
    return result.product;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.delete(`/api/products/${id}`);
  }

  // ── Returns (write) ───────────────────────────────────────────────

  async createReturn(input: CreateReturnInput, processedBy?: string): Promise<string> {
    const result = await this.post<{ returnId: string }>('/api/returns', { input, processedBy });
    return result.returnId;
  }

  // ── Generic HTTP helpers ──────────────────────────────────────────

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Register-Id': instoreApiConfig.current.registerId,
    };
    const secret = instoreApiConfig.current.sharedSecret;
    if (secret) {
      h['x-shared-secret'] = secret;
    }
    return h;
  }

  private get baseUrl(): string {
    return instoreApiConfig.baseUrl;
  }

  private buildHeaders(secretOverride?: string): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Register-Id': instoreApiConfig.current.registerId,
    };
    const secret = secretOverride ?? instoreApiConfig.current.sharedSecret;
    if (secret) {
      h['x-shared-secret'] = secret;
    }
    return h;
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

  private async getFromBaseUrl<T>(
    baseUrl: string,
    path: string,
    queryParams?: Record<string, string>,
    secretOverride?: string,
    timeoutMs?: number
  ): Promise<T> {
    let url = `${baseUrl.replace(/\/$/, '')}${path}`;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      url += `?${qs}`;
    }

    const controller = timeoutMs ? new AbortController() : undefined;
    const timeout = timeoutMs ? setTimeout(() => controller?.abort(), timeoutMs) : undefined;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(secretOverride),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `GET ${path} failed: ${response.status}`);
      }

      return response.json();
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
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

  private async put<T>(path: string, body: unknown): Promise<T> {
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

  private async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `DELETE ${path} failed: ${response.status}`);
    }
  }
}

export const instoreApiClient = InstoreApiClient.getInstance();
