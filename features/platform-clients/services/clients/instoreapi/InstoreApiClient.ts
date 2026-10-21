import { instoreApiConfig } from '../../../../multi-register/services/InstoreApiConfig';
import { LoggerFactory } from '../../../../../shared/services/logger/LoggerFactory';
import { SIGNATURE_HEADERS, signRequest } from '../../../../multi-register/services/requestSigning';
import { OrderRow, CreateOrderInput } from '../../../../orders-sync/repositories/OrderRepository';
import { OrderItemRow, CreateOrderItemInput } from '../../../../orders-sync/repositories/OrderItemRepository';
import { Product } from '../../../../catalogue/repositories/ProductRepository';
import { TaxProfileRow } from '../../../repositories/TaxProfileRepository';
import { ReturnRow, CreateReturnInput } from '../../../../returns/repositories/ReturnRepository';
import { Category } from '../../../../catalogue/services/category/CategoryServiceInterface';

export interface InstoreApiHealthResponse {
  ok: boolean;
  registerId?: string;
  registerName?: string;
}

export interface InstoreApiSyncEventsResponse<TEvent> {
  events: TEvent[];
}

/** Response shape of GET /api/reports/sales — server-side aggregation matching ReportingService semantics */
export interface InstoreApiSalesReport {
  summary: {
    totalOrders: number;
    totalSales: number;
    totalTax: number;
    totalDiscount: number;
    netSales: number;
    averageOrderValue: number;
  };
  salesByHour: Array<{ label: string; orderCount: number; totalSales: number }>;
  salesByDay: Array<{ label: string; orderCount: number; totalSales: number }>;
  cashierPerformance: Array<{
    cashierId: string;
    cashierName: string;
    orderCount: number;
    totalSales: number;
    averageOrderValue: number;
  }>;
  paymentBreakdown: Array<{ method: string; count: number; total: number; percentage: number }>;
  salesByRegister: Array<{ registerId: string; orderCount: number; totalSales: number }>;
}

/** Server shift record — /api/shifts responses */
export interface InstoreApiShift {
  id: string;
  startTime: number;
  endTime: number | null;
  cashierName: string;
  cashierId: string;
  openingCash: number;
  closingCash: number | null;
  status: string;
  registerId?: string;
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

  /**
   * Test the connection to the server via the authenticated /api/session
   * route — /api/health is unauthenticated and cannot detect a wrong secret.
   */
  async testConnection(): Promise<{ ok: boolean; registerName?: string; error?: string }> {
    try {
      const result = await this.get<InstoreApiHealthResponse>('/api/session');
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

  /**
   * Probe a server's health endpoint during discovery. Unauthenticated by
   * design — the secret must not be sent to every address on the subnet.
   */
  async probeHealth(baseUrl: string, timeoutMs: number = 2000): Promise<InstoreApiHealthResponse | null> {
    try {
      return await this.getFromBaseUrl<InstoreApiHealthResponse>(baseUrl, '/api/health', undefined, timeoutMs);
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

  /**
   * Server-side date-range query — orders created at [from, to) unix ms.
   * Avoids fetching the full orders table for report/history screens.
   */
  async getOrdersInRange(
    from: number,
    to: number,
    options?: { status?: string; cashierId?: string; registerId?: string }
  ): Promise<OrderRow[]> {
    const params: Record<string, string> = { from: String(from), to: String(to) };
    if (options?.status) params.status = options.status;
    if (options?.cashierId) params.cashierId = options.cashierId;
    if (options?.registerId) params.registerId = options.registerId;
    const result = await this.get<{ orders: OrderRow[] }>('/api/orders', params);
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

  /** Batch fetch line items for a set of orders (order lists, item counts) */
  async getOrderItems(orderIds: string[]): Promise<OrderItemRow[]> {
    if (orderIds.length === 0) {
      return [];
    }
    const result = await this.get<{ items: OrderItemRow[] }>('/api/order-items', { orderIds: orderIds.join(',') });
    return result.items;
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

  async updateOrderPayment(orderId: string, paymentMethod: string, transactionId?: string, paymentsJson?: string): Promise<OrderRow> {
    const result = await this.put<{ order: OrderRow }>(`/api/orders/${orderId}/payment`, { paymentMethod, transactionId, paymentsJson });
    return result.order;
  }

  async updateOrderSync(orderId: string, syncStatus: string, platformOrderId?: string, syncError?: string): Promise<OrderRow> {
    const result = await this.put<{ order: OrderRow }>(`/api/orders/${orderId}/sync`, { syncStatus, platformOrderId, syncError });
    return result.order;
  }

  /**
   * Atomically claim an order for platform sync so no other register pushes
   * a duplicate. Returns false on 409 (already synced or claimed).
   */
  async claimOrderSync(orderId: string): Promise<boolean> {
    const path = `/api/orders/${orderId}/sync/claim`;
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.buildSignedHeaders('PUT', path, ''),
    });
    if (response.status === 409) return false;
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `PUT ${path} failed: ${response.status}`);
    }
    return true;
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

  /** Delete a return row — used by the exchange saga to compensate an aborted exchange */
  async deleteReturn(id: string): Promise<void> {
    await this.delete(`/api/returns/${id}`);
  }

  // ── Snapshot ────────────────────────────────────────────────────────

  async getSnapshot(): Promise<{
    snapshot_version: number;
    orders: unknown[];
    products: unknown[];
    categories: unknown[];
    tax_profiles: unknown[];
  }> {
    return this.get('/api/snapshot');
  }

  // ── Users ─────────────────────────────────────────────────────────

  async getUsers(): Promise<Array<{ id: string; name: string; role: string; is_active: boolean }>> {
    const result = await this.get<{ users: Array<{ id: string; name: string; role: string; is_active: boolean }> }>('/api/users');
    return result.users;
  }

  async verifyPin(pin: string): Promise<{ id: string; name: string; role: string } | null> {
    try {
      const result = await this.post<{ user: { id: string; name: string; role: string } }>('/api/users/verify-pin', { pin });
      return result.user;
    } catch {
      // 401 = invalid PIN, not a network error
      return null;
    }
  }

  // ── Reports ───────────────────────────────────────────────────────

  /**
   * Store-wide (or register-scoped) sales analytics computed on the server.
   * tzOffset is minutes east of UTC (-new Date().getTimezoneOffset()) so
   * hour/day buckets follow this register's clock.
   */
  async getSalesReport(from: number, to: number, registerId?: string): Promise<InstoreApiSalesReport> {
    const params: Record<string, string> = {
      from: String(from),
      to: String(to),
      tzOffset: String(-new Date().getTimezoneOffset()),
    };
    if (registerId) params.registerId = registerId;
    const result = await this.get<{ report: InstoreApiSalesReport }>('/api/reports/sales', params);
    return result.report;
  }

  /** Server-generated orders CSV for a date range (same columns as local export) */
  async getOrdersCsv(from: number, to: number, registerId?: string): Promise<string> {
    const params: Record<string, string> = { from: String(from), to: String(to) };
    if (registerId) params.registerId = registerId;
    return this.getText('/api/reports/orders.csv', params);
  }

  // ── Shifts ────────────────────────────────────────────────────────
  //
  // Shifts are register-scoped on the server: at most one open shift per
  // register, so a Z-report always reconciles a single till.

  /** Shift history — pass registerId to scope to this register. */
  async getShifts(registerId?: string): Promise<InstoreApiShift[]> {
    const result = await this.get<{ shifts: InstoreApiShift[] }>('/api/shifts', registerId ? { registerId } : undefined);
    return result.shifts;
  }

  /** The register's currently open shift, or null when none is open. */
  async getCurrentShift(registerId: string): Promise<InstoreApiShift | null> {
    try {
      const result = await this.get<{ shift: InstoreApiShift }>('/api/shifts/current', { registerId });
      return result.shift;
    } catch {
      return null; // 404 = no open shift
    }
  }

  async openShift(cashierId: string, cashierName: string, openingCash?: number): Promise<InstoreApiShift> {
    const result = await this.post<{ shift: InstoreApiShift }>('/api/shifts', {
      cashierId,
      cashierName,
      openingCash: openingCash ?? 0,
    });
    return result.shift;
  }

  async closeShift(shiftId: string, closingCash?: number): Promise<InstoreApiShift> {
    const result = await this.put<{ shift: InstoreApiShift }>(`/api/shifts/${shiftId}`, {
      closingCash: closingCash ?? 0,
    });
    return result.shift;
  }

  // ── Generic HTTP helpers ──────────────────────────────────────────
  //
  // Every request is signed with the shared secret via HMAC — the secret
  // itself is never transmitted. `pathWithQuery` must be exactly what the
  // server receives (path plus query string) so the signature verifies.

  private get baseUrl(): string {
    return instoreApiConfig.baseUrl;
  }

  private buildSignedHeaders(method: string, pathWithQuery: string, rawBody: string): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const secret = instoreApiConfig.current.sharedSecret;
    if (secret) {
      const { timestamp, nonce, signature } = signRequest(secret, method, pathWithQuery, rawBody);
      h[SIGNATURE_HEADERS.register] = instoreApiConfig.current.registerId;
      h[SIGNATURE_HEADERS.timestamp] = timestamp;
      h[SIGNATURE_HEADERS.nonce] = nonce;
      h[SIGNATURE_HEADERS.signature] = signature;
    }
    return h;
  }

  private async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    let pathWithQuery = path;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      pathWithQuery += `?${qs}`;
    }

    const response = await fetch(`${this.baseUrl}${pathWithQuery}`, {
      method: 'GET',
      headers: this.buildSignedHeaders('GET', pathWithQuery, ''),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `GET ${path} failed: ${response.status}`);
    }

    return response.json();
  }

  /** Signed GET that returns the raw body (CSV downloads) */
  private async getText(path: string, queryParams?: Record<string, string>): Promise<string> {
    let pathWithQuery = path;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      pathWithQuery += `?${qs}`;
    }

    const response = await fetch(`${this.baseUrl}${pathWithQuery}`, {
      method: 'GET',
      headers: this.buildSignedHeaders('GET', pathWithQuery, ''),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `GET ${path} failed: ${response.status}`);
    }

    return response.text();
  }

  private async getFromBaseUrl<T>(baseUrl: string, path: string, queryParams?: Record<string, string>, timeoutMs?: number): Promise<T> {
    let pathWithQuery = path;
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString();
      pathWithQuery += `?${qs}`;
    }

    const controller = timeoutMs ? new AbortController() : undefined;
    const timeout = timeoutMs ? setTimeout(() => controller?.abort(), timeoutMs) : undefined;

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathWithQuery}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
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
    const rawBody = JSON.stringify(body);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.buildSignedHeaders('POST', path, rawBody),
      body: rawBody,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `POST ${path} failed: ${response.status}`);
    }

    return response.json();
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const rawBody = JSON.stringify(body);
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.buildSignedHeaders('PUT', path, rawBody),
      body: rawBody,
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
      headers: this.buildSignedHeaders('DELETE', path, ''),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `DELETE ${path} failed: ${response.status}`);
    }
  }
}

export const instoreApiClient = InstoreApiClient.getInstance();
