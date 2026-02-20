import { localApiConfig } from './LocalApiConfig';
import { LoggerFactory } from '../logger/LoggerFactory';
import { orderRepository } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { ProductRepository } from '../../repositories/ProductRepository';
import { taxProfileRepository } from '../../repositories/TaxProfileRepository';
import { returnRepository } from '../../repositories/ReturnRepository';
import { syncEventBus } from './sync/SyncEventBus';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RouteHandler {
  method: HttpMethod;
  path: string;
  handler: (params: Record<string, string>, body: unknown) => Promise<{ status: number; body: unknown }>;
}

/**
 * Lightweight local API server for multi-register offline setups.
 *
 * In React Native / Expo, we can't run a traditional Express server.
 * This service provides the *logic layer* — route definitions and handlers —
 * that can be mounted on top of a transport (e.g. a polled HTTP server via
 * `react-native-http-bridge`, or a WebSocket relay).
 *
 * The actual transport binding is in `LocalApiTransport.ts`.
 */
export class LocalApiServer {
  private static instance: LocalApiServer;
  private logger = LoggerFactory.getInstance().createLogger('LocalApiServer');
  private routes: RouteHandler[] = [];
  private running = false;
  private orderItemRepo = new OrderItemRepository();
  private productRepo = new ProductRepository();

  private constructor() {
    this.registerRoutes();
  }

  static getInstance(): LocalApiServer {
    if (!LocalApiServer.instance) {
      LocalApiServer.instance = new LocalApiServer();
    }
    return LocalApiServer.instance;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (!localApiConfig.isServer) {
      this.logger.warn('Cannot start server — not in server mode');
      return;
    }
    this.running = true;
    this.logger.info(`Local API server started on port ${localApiConfig.current.port}`);
  }

  stop(): void {
    this.running = false;
    this.logger.info('Local API server stopped');
  }

  /**
   * Handle an incoming request. Called by the transport layer.
   * Returns a response object with status and body.
   */
  async handleRequest(
    method: HttpMethod,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: unknown }> {
    if (!this.running) {
      return { status: 503, body: { error: 'Server not running' } };
    }

    // Authenticate via shared secret
    const secret = localApiConfig.current.sharedSecret;
    if (secret && headers?.['x-shared-secret'] !== secret) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    // Match route
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = this.matchPath(route.path, path);
      if (params !== null) {
        try {
          return await route.handler(params, body);
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
    // Health
    this.route('GET', '/api/health', async () => ({
      status: 200,
      body: {
        ok: true,
        registerId: localApiConfig.current.registerId,
        registerName: localApiConfig.current.registerName,
        timestamp: Date.now(),
      },
    }));

    // ── Orders ────────────────────────────────────────────────────────
    this.route('GET', '/api/orders', async (_params, body) => {
      const b = body as Record<string, unknown> | undefined;
      const status = b?.status as string | undefined;
      const rows = await orderRepository.findAll(status);
      return { status: 200, body: { orders: rows } };
    });

    this.route('GET', '/api/orders/:id', async params => {
      const row = await orderRepository.findById(params.id);
      if (!row) return { status: 404, body: { error: 'Order not found' } };
      const items = await this.orderItemRepo.findByOrderId(params.id);
      return { status: 200, body: { order: row, items } };
    });

    this.route('GET', '/api/orders/unsynced', async () => {
      const rows = await orderRepository.findUnsynced();
      return { status: 200, body: { orders: rows } };
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
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private route(method: HttpMethod, path: string, handler: RouteHandler['handler']): void {
    this.routes.push({ method, path, handler });
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

export const localApiServer = LocalApiServer.getInstance();
