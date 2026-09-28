# Architecture Patterns — RetailPOS

> Implementation patterns for services, repositories, hooks, and contexts. Match existing patterns exactly. See `docs/adr/` for decisions.

---

## Service Layer Pattern (ADR-005)

Four-layer structure for platform-integrating domains:

```
services/[domain]/
├── [Domain]ServiceInterface.ts          # Contract
├── [domain]ServiceFactory.ts            # Singleton factory
└── platforms/
    ├── Base[Domain]Service.ts           # Shared base (optional)
    ├── Shopify[Domain]Service.ts
    ├── WooCommerce[Domain]Service.ts
    ├── Offline[Domain]Service.ts        # Always present — SQLite fallback
    └── ...
```

### Interface

```typescript
export interface ProductServiceInterface {
  getProducts(options: ProductQueryOptions): Promise<ProductResult>;
  searchProducts(query: string): Promise<ProductResult>;
}
```

### Factory

```typescript
export class ProductServiceFactory {
  private static instance: ProductServiceFactory;
  private services = new Map<ECommercePlatform, ProductServiceInterface>();

  public static getInstance(): ProductServiceFactory {
    if (!ProductServiceFactory.instance) {
      ProductServiceFactory.instance = new ProductServiceFactory();
    }
    return ProductServiceFactory.instance;
  }

  public getService(platform: ECommercePlatform = ECommercePlatform.OFFLINE): ProductServiceInterface {
    if (!this.services.has(platform)) {
      this.services.set(platform, this.create(platform));
    }
    return this.services.get(platform)!;
  }

  private create(platform: ECommercePlatform): ProductServiceInterface {
    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        return new ShopifyProductService();
      default:
        return new OfflineProductService();
    }
  }
}
```

### Usage

```typescript
const service = ProductServiceFactory.getInstance().getService(platform);
const result = await service.getProducts({ page: 1, limit: 100 });
```

**Rules**:

- Factories cache instances — never `new XService()` outside factory
- `offline` is always `default` branch and universal fallback
- Hooks/UI call factories — never import platform implementations directly

---

## Repository Pattern (ADR-002, ADR-003)

Repositories own all SQLite access. Services never touch DB directly.

```typescript
// 1. Interface
export interface OrderRepository {
  create(order: CreateOrderInput): Promise<string>;
  findById(id: string): Promise<LocalOrder | null>;
  update(id: string, data: Partial<LocalOrder>): Promise<void>;
}

// 2. SQLite implementation
export class OfflineOrderRepository implements OrderRepository {
  private db = sqliteStorage.getDatabase();

  async create(order: CreateOrderInput): Promise<string> {
    const id = generateUUID();
    await this.db.runAsync(`INSERT INTO orders (id, total, status) VALUES (?, ?, ?)`, [id, order.total, order.status]);
    return id;
  }
}

// 3. Singleton
export const orderRepository = new OfflineOrderRepository();

// 4. Factory — mode-aware routing
export function getOrderRepository(): OrderRepository {
  return instoreApiConfig.isClient
    ? new InstoreApiOrderRepository() // HTTP to server
    : orderRepository; // local SQLite
}
```

**Rules**:

- Interface is plain noun (`OrderRepository`), not `IOrderRepository`
- SQLite class: `Offline[Entity]Repository`; HTTP class: `InstoreApi[Entity]Repository`
- Services receive interface type — no knowledge of implementation
- `BasketServiceFactory.buildContainer()` calls all `get[Entity]Repository()` at startup

---

## Context Provider Pattern

Contexts provide global state and expose service singletons.

```typescript
export interface BasketContextType {
  basket: Basket | null;
  isLoading: boolean;
  error: string | null;
  addToCart: (product: CartProduct, qty?: number) => Promise<void>;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export const BasketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [basket, setBasket] = useState<Basket | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const value = useMemo(
    () => ({ basket, isLoading, error, addToCart }),
    [basket, isLoading, error]
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
};

export const useBasketContext = (): BasketContextType => {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error('useBasketContext must be used within BasketProvider');
  return ctx;
};
```

**Rules**:

- Named exports (`export const XProvider`), never default
- Companion hook throws if used outside provider
- Context values memoized with `useMemo`

---

## Custom Hook Pattern

Hooks encapsulate data fetching, state, and service calls.

```typescript
interface UseProductsReturn {
  products: UnifiedProduct[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: (options?: ProductQueryOptions) => Promise<void>;
}

export const useProducts = (platform?: ECommercePlatform): UseProductsReturn => {
  const logger = useLogger('useProducts');
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(
    async (options?: ProductQueryOptions) => {
      setIsLoading(true);
      setError(null);
      try {
        const service = ProductServiceFactory.getInstance().getService(platform);
        const result = await service.getProducts(options ?? {});
        setProducts(result.products);
      } catch (err) {
        logger.error({ message: 'Failed to fetch products' }, err);
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setIsLoading(false);
      }
    },
    [platform]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, fetchProducts };
};
```

**Rules**:

- Always `export const useX`, never default
- State flag is `isLoading` (not `loading`)
- Errors through `logger.error()`, never `console.error`
- Wrap effects' subscriptions in cleanup functions

---

## ServiceConfigBridge

Connects credentials to service factories. **Only** place where factory `configure()` calls happen.

Called once after onboarding and when credentials change.

```
ServiceConfigBridge.configureServicesForPlatform(settings)
  → ProductServiceFactory.configureService(platform, apiConfig)
  → OrderServiceFactory.configureService(platform, apiConfig)
  → TaxServiceFactory.configureService(platform, apiConfig)
```

Factory imports are **lazy** (`require()`) to break circular dependencies.

---

## Basket → Checkout → Sync Split (ADR-001)

Three focused services own sale lifecycle:

| Service            | Owns                                                  |
| ------------------ | ----------------------------------------------------- |
| `BasketService`    | Cart CRUD, recalculate totals                         |
| `CheckoutService`  | `startCheckout()`, `completePayment()`, order queries |
| `OrderSyncService` | Sync paid orders, retry logic                         |

`BasketService` never creates orders. `CheckoutService` never modifies basket. `OrderSyncService` never touches basket.

---

## Tax Strategy Pattern

Platform-specific tax via strategy pattern:

```
TaxServiceFactory
  └── getService(platform) → TaxServiceInterface
        ├── ShopifyTaxStrategy
        ├── WooCommerceTaxStrategy
        ├── OfflineTaxStrategy
```

Every strategy extends `BaseTaxStrategy` with five-step resolution:

1. Normalize tax code
2. Exempt fast-path
3. Live platform rate
4. Local profile fallback
5. Default profile fallback

---

## Background Sync

```
completePayment()
  └── OrderSyncService.syncOrderToPlatform()   ← non-blocking
        └── on failure: retry count++, exponential backoff

BackgroundSyncService (periodic)
  └── re-runs sync for pending/failed orders
  └── backoff: base × 2^failures, capped at 15 min
  └── pauses when backgrounded, resumes on foreground
```

**Retry**: Network errors + 5xx retryable; 4xx not retryable.

---

## Background Jobs — AppState Pattern

> **No cron in mobile apps.** OS suspends process when backgrounded. `setInterval` stops. Use `AppState` foreground-event pattern.

### Pattern

1. `start()` — Subscribe to `AppState.addEventListener('change')`. On `'active'`, call `runIfDue()`
2. `runIfDue()` — Read persisted timestamp from KV. If < `minIntervalMs` elapsed, return
3. `run()` — Execute work, persist timestamp on success
4. `stop()` — Remove subscription

```typescript
const LAST_RUN_KEY = 'myJob:lastRun';
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

start(): void {
  this.appStateSubscription = AppState.addEventListener('change', state => {
    if (state === 'active') this.runIfDue().catch(...);
  });
  this.runIfDue(); // check immediately
}

async runIfDue(): Promise<void> {
  const raw = await this.kv.getItem(LAST_RUN_KEY);
  const lastRun = raw ? parseInt(raw, 10) : 0;
  if (Date.now() - lastRun < INTERVAL_MS) return;
  await this.run();
}

async run(): Promise<void> {
  // ... work ...
  await this.kv.setItem(LAST_RUN_KEY, Date.now().toString());
}
```

**Rules**:

- Never `setInterval`/`setTimeout` for periodic tasks
- Never reference cron syntax
- Persist `lastRun` only on success
- `run()` must be idempotent, guard concurrent execution
- Call `start()` once at app startup

---

## Logger Injection

All services receive logger via constructor or `LoggerFactory`:

```typescript
const logger = LoggerFactory.getInstance().createLogger('BasketService');

logger.info({ message: 'Item added', productId, quantity });
logger.error({ message: 'Sync failed' }, error);
```

Add transports (Sentry, Datadog) once at startup — child loggers inherit automatically.
