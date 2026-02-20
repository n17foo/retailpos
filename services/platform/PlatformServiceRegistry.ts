/**
 * ============================================================================
 * PLATFORM SERVICE REGISTRY
 * ============================================================================
 * Central entry-point that resolves every domain service for a given
 * ECommercePlatform.  Instead of each hook / screen importing half a dozen
 * individual factories, they call:
 *
 *   const services = PlatformServiceRegistry.getInstance().getServices(platform);
 *
 * The registry delegates to the existing singleton factories under the hood,
 * so no existing service code needs to change.
 * ============================================================================
 */

import { ECommercePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger/LoggerFactory';

// Domain service interfaces
import { ProductServiceInterface } from '../product/ProductServiceInterface';
import { CategoryServiceInterface } from '../category/CategoryServiceInterface';
import { OrderServiceInterface } from '../order/OrderServiceInterface';
import { InventoryServiceInterface } from '../inventory/InventoryServiceInterface';
import { SearchServiceInterface } from '../search/SearchServiceInterface';
import { RefundServiceInterface } from '../refund/RefundServiceInterface';
import { BasketServiceInterface } from '../basket/BasketServiceInterface';
import { TokenServiceInterface } from '../token/TokenServiceInterface';

// Domain service factories
import { ProductServiceFactory } from '../product/ProductServiceFactory';
import { CategoryServiceFactory } from '../category/CategoryServiceFactory';
import { OrderServiceFactory } from '../order/OrderServiceFactory';
import { InventoryServiceFactory } from '../inventory/InventoryServiceFactory';
import { SearchServiceFactory } from '../search/SearchServiceFactory';
import { RefundServiceFactory } from '../refund/RefundServiceFactory';
import { BasketServiceFactory } from '../basket/BasketServiceFactory';
import { TokenServiceFactory } from '../token/TokenServiceFactory';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The full set of domain services resolved for a single platform.
 */
export interface PlatformServices {
  /** Active platform */
  platform: ECommercePlatform;
  /** Product CRUD & sync */
  product: ProductServiceInterface;
  /** Category listing */
  category: CategoryServiceInterface;
  /** Order creation & retrieval */
  order: OrderServiceInterface;
  /** Inventory queries & updates */
  inventory: InventoryServiceInterface;
  /** Product search */
  search: SearchServiceInterface;
  /** Refund processing */
  refund: RefundServiceInterface;
  /** Basket / checkout */
  basket: BasketServiceInterface;
  /** Token management */
  token: TokenServiceInterface;
}

/**
 * Optional configuration passed when switching platforms.
 */
export interface PlatformConfig {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class PlatformServiceRegistry {
  // Singleton --
  private static instance: PlatformServiceRegistry;

  private logger = LoggerFactory.getInstance().createLogger('PlatformServiceRegistry');

  // Resolved bundles keyed by platform
  private resolved = new Map<ECommercePlatform, PlatformServices>();

  // Cached basket service (platform-agnostic)
  private basketService: BasketServiceInterface | null = null;
  private basketInitialised = false;

  private constructor() {}

  public static getInstance(): PlatformServiceRegistry {
    if (!PlatformServiceRegistry.instance) {
      PlatformServiceRegistry.instance = new PlatformServiceRegistry();
    }
    return PlatformServiceRegistry.instance;
  }

  // -------------------------------------------------------------------------
  // Main API
  // -------------------------------------------------------------------------

  /**
   * Resolve every domain service for the given platform.
   * Results are cached – calling twice with the same platform is cheap.
   */
  public getServices(platform: ECommercePlatform): PlatformServices {
    const cached = this.resolved.get(platform);
    if (cached) return cached;

    this.logger.info({ message: `Resolving services for platform: ${platform}` });

    const bundle: PlatformServices = {
      platform,
      product: ProductServiceFactory.getInstance().getService(platform),
      category: CategoryServiceFactory.getInstance().getService(platform),
      order: OrderServiceFactory.getInstance().getService(platform),
      inventory: InventoryServiceFactory.getInstance().getService(platform),
      search: SearchServiceFactory.getInstance().getService(),
      refund: RefundServiceFactory.getInstance().getRefundServiceForPlatform(platform),
      basket: this.getBasketServiceSync(),
      token: TokenServiceFactory.getInstance().getService(),
    };

    this.resolved.set(platform, bundle);
    return bundle;
  }

  /**
   * Convenience: resolve a single domain service.
   */
  public getProductService(platform: ECommercePlatform): ProductServiceInterface {
    return this.getServices(platform).product;
  }

  public getCategoryService(platform: ECommercePlatform): CategoryServiceInterface {
    return this.getServices(platform).category;
  }

  public getOrderService(platform: ECommercePlatform): OrderServiceInterface {
    return this.getServices(platform).order;
  }

  public getInventoryService(platform: ECommercePlatform): InventoryServiceInterface {
    return this.getServices(platform).inventory;
  }

  public getSearchService(): SearchServiceInterface {
    return SearchServiceFactory.getInstance().getService();
  }

  public getRefundService(platform: ECommercePlatform): RefundServiceInterface {
    return this.getServices(platform).refund;
  }

  public async getBasketService(): Promise<BasketServiceInterface> {
    return BasketServiceFactory.getInstance().getService();
  }

  public getTokenService(): TokenServiceInterface {
    return TokenServiceFactory.getInstance().getService();
  }

  // -------------------------------------------------------------------------
  // Platform switching
  // -------------------------------------------------------------------------

  /**
   * Clear cached services for a platform (e.g. after credentials change).
   */
  public invalidate(platform: ECommercePlatform): void {
    this.resolved.delete(platform);
    this.logger.info({ message: `Invalidated cached services for platform: ${platform}` });
  }

  /**
   * Clear all cached services.
   */
  public invalidateAll(): void {
    this.resolved.clear();
    this.logger.info({ message: 'Invalidated all cached platform services' });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private getBasketServiceSync(): BasketServiceInterface {
    if (!this.basketService) {
      this.basketService = BasketServiceFactory.getInstance().getServiceSync();
    }
    if (!this.basketInitialised) {
      // Fire-and-forget init — the BasketService is resilient to being called pre-init
      BasketServiceFactory.getInstance()
        .getService()
        .then(() => {
          this.basketInitialised = true;
        })
        .catch(err => {
          this.logger.error({ message: 'BasketService async initialisation failed' }, err instanceof Error ? err : new Error(String(err)));
        });
    }
    return this.basketService;
  }
}
