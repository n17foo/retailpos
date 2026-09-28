import { instoreApiConfig } from './InstoreApiConfig';
import { LoggerFactory } from '../logger/LoggerFactory';
import { orderRepository, CreateOrderInput } from '../../repositories/OrderRepository';
import { OrderItemRepository, CreateOrderItemInput } from '../../repositories/OrderItemRepository';
import { ProductRepository } from '../../repositories/ProductRepository';
import { taxProfileRepository } from '../../repositories/TaxProfileRepository';
import { returnRepository, CreateReturnInput } from '../../repositories/ReturnRepository';
import { userRepository } from '../../repositories/UserRepository';
import { syncEventBus } from './sync/SyncEventBus';
import { CommercefullWebhookReceiver } from '../clients/commercefull/CommercefullWebhookReceiver';
import { offlineProductService } from '../product/platforms/OfflineProductService';
import { offlineCategoryService } from '../category/platforms/OfflineCategoryService';
import type { Category } from '../category/CategoryServiceInterface';
import type { Product } from '../product/ProductServiceInterface';
import { instoreApiTransport } from './InstoreApiTransport';
import { validateReturnRequest } from '../refunds/returnValidation';
import { randomHex } from '../../utils/crypto';
import { SIGNATURE_HEADERS, SIGNATURE_WINDOW_MS, verifyRequestSignature } from './requestSigning';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RouteHandler {
  method: HttpMethod;
  path: string;
  handler: (params: Record<string, string>, body: unknown, headers?: Record<string, string>) => Promise<{ status: number; body: unknown }>;
}

/**
 * Lightweight instoreapi API server for multi-register offline setups.
 *
 * In React Native / Expo, we can't run a traditional Express server.
 * This service provides the *logic layer* — route definitions and handlers —
 * that can be mounted on top of a transport (e.g. a polled HTTP server via
 * `react-native-http-bridge`, or a WebSocket relay).
 *
 * The actual transport binding is in `InstoreApiTransport.ts`.
 */
export class InstoreApiServer {
  private static instance: InstoreApiServer;
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiServer');
  private routes: RouteHandler[] = [];
  private running = false;
  private orderItemRepo = new OrderItemRepository();
  private productRepo = new ProductRepository();

  // Server-side brute-force guard for /api/users/verify-pin: a client holding
  // the shared secret could otherwise enumerate the PIN space over the LAN.
  private static readonly PIN_MAX_FAILURES = 10;
  private static readonly PIN_WINDOW_MS = 60_000;
  private pinFailures: number[] = [];

  // Replay protection for signed requests: nonces are remembered for the
  // signature timestamp window so a captured request cannot be re-sent.
  private static readonly MAX_NONCE_CACHE = 10_000;
  private nonceCache = new Map<string, number>(); // `${registerId}:${nonce}` → expiry ms

  private static readonly ORDER_STATUSES = new Set(['pending', 'processing', 'paid', 'synced', 'failed', 'cancelled']);
  private static readonly MAX_ORDER_ITEMS = 500;
  private static readonly MAX_MONEY = 1_000_000_000;
  private static readonly MAX_PRODUCT_VARIANTS = 500;

  private constructor() {
    this.registerRoutes();
  }

  static getInstance(): InstoreApiServer {
    if (!InstoreApiServer.instance) {
      InstoreApiServer.instance = new InstoreApiServer();
    }
    return InstoreApiServer.instance;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    if (!instoreApiConfig.isServer) {
      this.logger.warn('Cannot start server — not in server mode');
      return;
    }

    // Never run the LAN API unauthenticated: if no shared secret is
    // configured, generate one now and persist it. The secret is surfaced in
    // Settings → Instore API so the operator can copy it to client registers.
    if (!instoreApiConfig.current.sharedSecret) {
      const generated = `instore-${randomHex(16)}`;
      await instoreApiConfig.save({ sharedSecret: generated });
      this.logger.warn(
        'No shared secret configured — generated one automatically. Copy it from Settings → Instore API to client registers.'
      );
    }

    this.running = true;

    try {
      // Start the HTTP transport layer
      await instoreApiTransport.start();
      this.logger.info(`Local API server started on port ${instoreApiConfig.current.port}`);
    } catch (error) {
      this.running = false;
      this.logger.error('Failed to start HTTP transport:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    try {
      // Stop the HTTP transport layer
      await instoreApiTransport.stop();
      this.logger.info('Local API server stopped');
    } catch (error) {
      this.logger.error('Failed to stop HTTP transport:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Handle an incoming request. Called by the transport layer.
   * `path` includes the query string and `rawBody` is the exact request body —
   * both are covered by the request signature. Returns a response object with
   * status and body.
   */
  async handleRequest(
    method: HttpMethod,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
    rawBody: string = ''
  ): Promise<{ status: number; body: unknown }> {
    if (!this.running) {
      return { status: 503, body: { error: 'Server not running' } };
    }

    // Authenticate via HMAC-signed requests. The shared secret is never sent
    // on the wire; the legacy `x-shared-secret` header is ignored entirely.
    // Two exemptions:
    // - /api/health only exposes register presence and must stay reachable so
    //   client registers can discover the server before they have the secret.
    // - /api/webhooks/commercefull can't sign with our LAN secret — it
    //   authenticates via the Commercefull HMAC verified in the receiver.
    const cleanPath = path.split('?')[0];
    const normalizedHeaders = Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
    const isUnauthenticatedRoute = cleanPath === '/api/webhooks/commercefull' || cleanPath === '/api/health';
    if (!isUnauthenticatedRoute) {
      const secret = instoreApiConfig.current.sharedSecret;
      if (!secret) {
        return { status: 503, body: { error: 'Server not configured' } };
      }
      const verification = verifyRequestSignature(secret, method, path, rawBody, normalizedHeaders);
      if (!verification.ok) {
        return { status: 401, body: { error: 'Unauthorized' } };
      }
      if (!this.claimNonce(verification.registerId, normalizedHeaders[SIGNATURE_HEADERS.nonce])) {
        return { status: 401, body: { error: 'Unauthorized' } };
      }
    }

    // Match route
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = this.matchPath(route.path, path);
      if (params !== null) {
        try {
          return await route.handler(params, body, normalizedHeaders);
        } catch (error) {
          this.logger.error({ message: `Error handling ${method} ${path}` }, error instanceof Error ? error : new Error(String(error)));
          return { status: 500, body: { error: 'Internal server error' } };
        }
      }
    }

    return { status: 404, body: { error: 'Not found' } };
  }

  // ── Route registration ──────────────────────────────────────────────

  private registerRoutes(): void {
    // Health — intentionally unauthenticated so client registers can discover
    // the server before they hold the shared secret. Exposes presence only.
    this.route('GET', '/api/health', async () => ({
      status: 200,
      body: {
        ok: true,
        registerId: instoreApiConfig.current.registerId,
        registerName: instoreApiConfig.current.registerName,
        timestamp: Date.now(),
      },
    }));

    // Authenticated connectivity check — unlike /api/health this proves the
    // caller holds a valid shared secret.
    this.route('GET', '/api/session', async () => ({
      status: 200,
      body: {
        ok: true,
        registerId: instoreApiConfig.current.registerId,
        registerName: instoreApiConfig.current.registerName,
      },
    }));

    // ── Orders ────────────────────────────────────────────────────────
    this.route('GET', '/api/orders', async (_params, body) => {
      const b = body as Record<string, unknown> | undefined;
      const status = typeof b?.status === 'string' && InstoreApiServer.ORDER_STATUSES.has(b.status) ? b.status : undefined;
      const rows = await orderRepository.findAll(status);
      return { status: 200, body: { orders: rows } };
    });

    // Literal routes must be registered before parameterized ones —
    // /api/orders/:id would otherwise swallow 'unsynced'.
    this.route('GET', '/api/orders/unsynced', async () => {
      const rows = await orderRepository.findUnsynced();
      return { status: 200, body: { orders: rows } };
    });

    this.route('GET', '/api/orders/:id', async params => {
      const row = await orderRepository.findById(params.id);
      if (!row) return { status: 404, body: { error: 'Order not found' } };
      const items = await this.orderItemRepo.findByOrderId(params.id);
      return { status: 200, body: { order: row, items } };
    });

    // ── Products ──────────────────────────────────────────────────────
    this.route('GET', '/api/products', async () => {
      const rows = await this.productRepo.findAll();
      return { status: 200, body: { products: rows } };
    });

    this.route('GET', '/api/products/:id', async params => {
      const row = await this.productRepo.findById(params.id);
      if (!row) return { status: 404, body: { error: 'Product not found' } };
      return { status: 200, body: { product: row } };
    });

    // ── Tax Profiles ──────────────────────────────────────────────────
    this.route('GET', '/api/tax-profiles', async () => {
      const rows = await taxProfileRepository.findActive();
      return { status: 200, body: { taxProfiles: rows } };
    });

    // ── Returns ───────────────────────────────────────────────────────
    this.route('GET', '/api/returns', async (_params, body) => {
      const b = body as Record<string, unknown> | undefined;
      const status = b?.status as string | undefined;
      const rows = await returnRepository.findAll(status);
      return { status: 200, body: { returns: rows } };
    });

    this.route('GET', '/api/returns/order/:orderId', async params => {
      const rows = await returnRepository.findByOrderId(params.orderId);
      return { status: 200, body: { returns: rows } };
    });

    // ── Sync Events (polling endpoint for client registers) ───────────
    this.route('GET', '/api/sync/events', async (_params, body) => {
      const b = body as Record<string, unknown> | undefined;
      const since = parseInt(String(b?.since || '0'), 10) || 0;
      const events = syncEventBus.getEventsSince(since);
      return { status: 200, body: { events } };
    });

    // ── Users (PIN verify for client registers — never expose PIN values) ──
    this.route('GET', '/api/users', async () => {
      const rows = await userRepository.findActive();
      return {
        status: 200,
        body: { users: rows.map(u => ({ id: u.id, name: u.name, role: u.role, is_active: u.is_active })) },
      };
    });

    this.route('POST', '/api/users/verify-pin', async (_params, body) => {
      const now = Date.now();
      this.pinFailures = this.pinFailures.filter(failedAt => now - failedAt < InstoreApiServer.PIN_WINDOW_MS);
      if (this.pinFailures.length >= InstoreApiServer.PIN_MAX_FAILURES) {
        return { status: 429, body: { error: 'Too many attempts. Try again later.' } };
      }
      const b = body as { pin?: unknown } | undefined;
      const pin = typeof b?.pin === 'string' && /^\d{6}$/.test(b.pin) ? b.pin : '';
      const user = pin ? await userRepository.findByPin(pin) : null;
      if (!user) {
        this.pinFailures.push(now);
        if (this.pinFailures.length === InstoreApiServer.PIN_MAX_FAILURES) {
          this.logger.warn('PIN verify rate limit hit — locking endpoint for 60s');
        }
        return { status: 401, body: { error: 'Invalid PIN' } };
      }
      return { status: 200, body: { user: { id: user.id, name: user.name, role: user.role } } };
    });

    // ── Full state snapshot (WebSocket snapshot_needed flow) ─────────
    this.route('GET', '/api/snapshot', async () => {
      const [orders, products, categories, taxProfiles] = await Promise.all([
        orderRepository.findAll(),
        this.productRepo.findAll(),
        offlineCategoryService.getCategories(),
        taxProfileRepository.findActive(),
      ]);
      return {
        status: 200,
        body: { snapshot_version: Date.now(), orders, products, categories, tax_profiles: taxProfiles },
      };
    });

    // ── Webhook Receiver (Commercefull real-time push) ────────────────
    this.route('POST', '/api/webhooks/commercefull', async (_params, body, headers) => {
      const receiver = CommercefullWebhookReceiver.getInstance();
      const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
      return await receiver.handleRequest(rawBody, headers || {});
    });

    // ── Categories ────────────────────────────────────────────────────
    this.route('GET', '/api/categories', async () => {
      const rows = await offlineCategoryService.getCategories();
      return { status: 200, body: { categories: rows } };
    });

    this.route('POST', '/api/categories', async (_params, body) => {
      const data = this.sanitizeCategoryInput(body, true);
      if (typeof data === 'string') return { status: 400, body: { error: data } };
      // requireName=true guarantees `name` is present and valid
      const category = await offlineCategoryService.addCategory(data as Omit<Category, 'id'>);
      syncEventBus.emit('config:updated', { entity: 'category', action: 'created', category });
      return { status: 201, body: { category } };
    });

    this.route('PUT', '/api/categories/:id', async (params, body) => {
      const data = this.sanitizeCategoryInput(body, false);
      if (typeof data === 'string') return { status: 400, body: { error: data } };
      const category = await offlineCategoryService.updateCategory(params.id, data);
      syncEventBus.emit('config:updated', { entity: 'category', action: 'updated', category });
      return { status: 200, body: { category } };
    });

    this.route('DELETE', '/api/categories/:id', async params => {
      await offlineCategoryService.deleteCategory(params.id);
      syncEventBus.emit('config:updated', { entity: 'category', action: 'deleted', id: params.id });
      return { status: 200, body: { ok: true } };
    });

    // ── Orders (write) ────────────────────────────────────────────────
    this.route('POST', '/api/orders', async (_params, body) => {
      const parsed = this.sanitizeOrderInput(body);
      if (typeof parsed === 'string') return { status: 400, body: { error: parsed } };
      await orderRepository.create(parsed.order);
      await this.orderItemRepo.createMany(parsed.items);
      const row = await orderRepository.findById(parsed.order.id);
      syncEventBus.emit('order:created', { orderId: parsed.order.id });
      return { status: 201, body: { order: row } };
    });

    this.route('PUT', '/api/orders/:id/status', async (params, body) => {
      const b = body as { status?: unknown } | undefined;
      if (typeof b?.status !== 'string' || !InstoreApiServer.ORDER_STATUSES.has(b.status)) {
        return { status: 400, body: { error: 'Invalid order status' } };
      }
      const existing = await orderRepository.findById(params.id);
      if (!existing) return { status: 404, body: { error: 'Order not found' } };
      await orderRepository.updateStatus(params.id, b.status);
      const row = await orderRepository.findById(params.id);
      syncEventBus.emit('order:updated', { orderId: params.id, status: b.status });
      return { status: 200, body: { order: row } };
    });

    this.route('PUT', '/api/orders/:id/payment', async (params, body) => {
      const b = body as { paymentMethod?: unknown; transactionId?: unknown } | undefined;
      if (
        typeof b?.paymentMethod !== 'string' ||
        b.paymentMethod.length === 0 ||
        b.paymentMethod.length > 64 ||
        (b.transactionId !== undefined && (typeof b.transactionId !== 'string' || b.transactionId.length > 256))
      ) {
        return { status: 400, body: { error: 'Invalid payment update' } };
      }
      const existing = await orderRepository.findById(params.id);
      if (!existing) return { status: 404, body: { error: 'Order not found' } };
      await orderRepository.updatePayment(params.id, b.paymentMethod, b.transactionId ?? null);
      const row = await orderRepository.findById(params.id);
      syncEventBus.emit('order:paid', { orderId: params.id });
      return { status: 200, body: { order: row } };
    });

    // ── Products (write) ──────────────────────────────────────────────
    this.route('POST', '/api/products', async (_params, body) => {
      const data = this.sanitizeProductInput(body, true);
      if (typeof data === 'string') return { status: 400, body: { error: data } };
      // requireTitle=true guarantees a title; id is generated by the service
      const product = await offlineProductService.createProduct(data as Product);
      syncEventBus.emit('product:updated', { action: 'created', product });
      return { status: 201, body: { product } };
    });

    this.route('PUT', '/api/products/:id', async (params, body) => {
      const data = this.sanitizeProductInput(body, false);
      if (typeof data === 'string') return { status: 400, body: { error: data } };
      const product = await offlineProductService.updateProduct(params.id, data);
      syncEventBus.emit('product:updated', { action: 'updated', product });
      return { status: 200, body: { product } };
    });

    this.route('DELETE', '/api/products/:id', async params => {
      await offlineProductService.deleteProduct(params.id);
      syncEventBus.emit('product:updated', { action: 'deleted', id: params.id });
      return { status: 200, body: { ok: true } };
    });

    // ── Returns (write) ───────────────────────────────────────────────
    // The same integrity rules as ReturnService.applyToLocalOrder apply on the
    // server: a LAN client must not be able to return more than was sold or
    // refund more than was paid.
    this.route('POST', '/api/returns', async (_params, body) => {
      const b = body as { input?: unknown; processedBy?: unknown } | undefined;
      const input = b?.input;
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { status: 400, body: { error: 'Invalid return input' } };
      }
      const ret = input as Record<string, unknown>;
      if (typeof ret.orderId !== 'string' || ret.orderId.length === 0 || ret.orderId.length > 128) {
        return { status: 400, body: { error: 'Invalid return order id' } };
      }
      if (typeof ret.productName !== 'string' || ret.productName.length === 0 || ret.productName.length > 512) {
        return { status: 400, body: { error: 'Invalid return product name' } };
      }
      if (b.processedBy !== undefined && (typeof b.processedBy !== 'string' || b.processedBy.length > 128)) {
        return { status: 400, body: { error: 'Invalid processedBy' } };
      }

      const order = await orderRepository.findById(ret.orderId);
      if (!order) return { status: 404, body: { error: 'Order not found' } };
      const orderItems = await this.orderItemRepo.findByOrderId(ret.orderId);
      const existingReturns = await returnRepository.findByOrderId(ret.orderId);
      const validationError = validateReturnRequest(
        [
          {
            orderItemId: (ret.orderItemId as string | null | undefined) ?? null,
            productId: ret.productId as string,
            quantity: ret.quantity as number,
            refundAmount: ret.refundAmount as number,
          },
        ],
        {
          orderStatus: order.status,
          orderTotal: order.total,
          orderItems,
          existingReturns,
        }
      );
      if (validationError) return { status: 422, body: { error: validationError } };

      const id = await returnRepository.create(input as CreateReturnInput);
      await returnRepository.updateStatus(id, 'completed', b.processedBy as string | undefined);
      syncEventBus.emit('return:created', { returnId: id, orderId: ret.orderId });
      return { status: 201, body: { returnId: id } };
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private route(method: HttpMethod, path: string, handler: RouteHandler['handler']): void {
    this.routes.push({ method, path, handler });
  }

  /**
   * Record a nonce, returning false if it was already used within the
   * signature window. Entries expire with the timestamp window — a replay
   * outside the window is already rejected by the timestamp check.
   */
  private claimNonce(registerId: string, nonce: string): boolean {
    const now = Date.now();
    const key = `${registerId}:${nonce}`;
    const expiresAt = this.nonceCache.get(key);
    if (expiresAt !== undefined && expiresAt > now) return false;

    if (this.nonceCache.size >= InstoreApiServer.MAX_NONCE_CACHE) {
      for (const [k, exp] of this.nonceCache) {
        if (exp <= now) this.nonceCache.delete(k);
      }
      // Still full — evict oldest entries (Map iterates in insertion order)
      while (this.nonceCache.size >= InstoreApiServer.MAX_NONCE_CACHE) {
        const oldest = this.nonceCache.keys().next();
        if (oldest.done) break;
        this.nonceCache.delete(oldest.value);
      }
    }
    this.nonceCache.set(key, now + SIGNATURE_WINDOW_MS);
    return true;
  }

  private static isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static isBoundedString(value: unknown, maxLength: number): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
  }

  private static isFiniteNumberInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  }

  /**
   * Allowlist and bound a category write payload. Returns an error message or
   * the sanitized partial — internal platform metadata is never accepted.
   */
  private sanitizeCategoryInput(body: unknown, requireName: boolean): Partial<Category> | string {
    if (!InstoreApiServer.isPlainObject(body)) return 'Invalid category';
    const out: Partial<Category> = {};

    if (body.name !== undefined) {
      if (!InstoreApiServer.isBoundedString(body.name, 256)) return 'Invalid category name';
      out.name = body.name.trim();
    } else if (requireName) {
      return 'Invalid category name';
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || body.description.length > 2000) return 'Invalid category description';
      out.description = body.description;
    }
    if (body.parentId !== undefined) {
      if (typeof body.parentId !== 'string' || body.parentId.length > 128) return 'Invalid category parent';
      out.parentId = body.parentId;
    }
    if (body.image !== undefined) {
      if (typeof body.image !== 'string' || body.image.length > 2048) return 'Invalid category image';
      out.image = body.image;
    }
    if (body.subcategories !== undefined) {
      if (!Array.isArray(body.subcategories) || body.subcategories.length > 200) return 'Invalid category subcategories';
      out.subcategories = body.subcategories as Category[];
    }
    return out;
  }

  /**
   * Allowlist and bound a product write payload for the offline product store.
   */
  private sanitizeProductInput(body: unknown, requireTitle: boolean): Partial<Product> | string {
    if (!InstoreApiServer.isPlainObject(body)) return 'Invalid product';
    const out: Record<string, unknown> = {};

    const title = body.title ?? body.name;
    if (title !== undefined) {
      if (!InstoreApiServer.isBoundedString(title, 512)) return 'Invalid product title';
      out.title = title;
    } else if (requireTitle) {
      return 'Invalid product title';
    }

    for (const field of ['description', 'vendor', 'productType'] as const) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string' || (body[field] as string).length > 2000) return `Invalid product ${field}`;
        out[field] = body[field];
      }
    }
    for (const field of ['tags', 'options', 'variants', 'images'] as const) {
      if (body[field] !== undefined) {
        if (!Array.isArray(body[field]) || (body[field] as unknown[]).length > InstoreApiServer.MAX_PRODUCT_VARIANTS) {
          return `Invalid product ${field}`;
        }
        out[field] = body[field];
      }
    }
    if (body.price !== undefined) {
      if (!InstoreApiServer.isFiniteNumberInRange(body.price, 0, InstoreApiServer.MAX_MONEY)) return 'Invalid product price';
      out.price = body.price;
    }
    for (const field of ['sku', 'barcode', 'category_id', 'name'] as const) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== 'string' || (body[field] as string).length > 512) return `Invalid product ${field}`;
        out[field] = body[field];
      }
    }
    if (body.stock !== undefined) {
      if (!InstoreApiServer.isFiniteNumberInRange(body.stock, 0, 1_000_000)) return 'Invalid product stock';
      out.stock = body.stock;
    }
    return out as Partial<Product>;
  }

  /**
   * Validate the shape and bounds of an order create payload — order fields,
   * item array bounds, and per-item types. Items must belong to the order.
   */
  private sanitizeOrderInput(body: unknown): { order: CreateOrderInput; items: CreateOrderItemInput[] } | string {
    if (!InstoreApiServer.isPlainObject(body)) return 'Invalid order payload';
    const order = body.order;
    const items = body.items;
    if (!InstoreApiServer.isPlainObject(order)) return 'Invalid order';
    if (!InstoreApiServer.isBoundedString(order.id, 128)) return 'Invalid order id';
    for (const field of ['subtotal', 'tax', 'total']) {
      if (!InstoreApiServer.isFiniteNumberInRange(order[field], 0, InstoreApiServer.MAX_MONEY)) {
        return `Invalid order ${field}`;
      }
    }
    if (!Array.isArray(items) || items.length > InstoreApiServer.MAX_ORDER_ITEMS) return 'Invalid order items';
    for (const item of items) {
      if (!InstoreApiServer.isPlainObject(item)) return 'Invalid order item';
      if (item.orderId !== order.id) return 'Order item does not belong to this order';
      if (!InstoreApiServer.isBoundedString(item.productId, 128)) return 'Invalid order item product';
      if (!InstoreApiServer.isBoundedString(item.name, 512)) return 'Invalid order item name';
      if (!InstoreApiServer.isFiniteNumberInRange(item.price, 0, InstoreApiServer.MAX_MONEY)) return 'Invalid order item price';
      if (!InstoreApiServer.isFiniteNumberInRange(item.quantity, 0, 1_000_000) || item.quantity <= 0) {
        return 'Invalid order item quantity';
      }
    }
    return { order: order as unknown as CreateOrderInput, items: items as CreateOrderItemInput[] };
  }

  /**
   * Simple path matcher supporting `:param` segments.
   * Returns params map or null if no match.
   */
  private matchPath(pattern: string, actual: string): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('?')[0].split('/').filter(Boolean);

    if (patternParts.length !== actualParts.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = actualParts[i];
      } else if (patternParts[i] !== actualParts[i]) {
        return null;
      }
    }
    return params;
  }
}

export const instoreApiServer = InstoreApiServer.getInstance();
