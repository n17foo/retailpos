import { BasketService } from './BasketService';
import { BasketServiceInterface } from './BasketServiceInterface';
import { CheckoutService } from '../../checkout/services/CheckoutService';
import { CheckoutServiceInterface } from '../../checkout/services/CheckoutServiceInterface';
import { OrderSyncService } from '../../orders-sync/services/sync/OrderSyncService';
import { OrderSyncServiceInterface } from '../../orders-sync/services/sync/OrderSyncServiceInterface';
import { BasketRepository } from '../repositories/BasketRepository';
import { OrderRepository, getOrderRepository } from '../../orders-sync/repositories/OrderRepository';
import { OrderItemRepository } from '../../orders-sync/repositories/OrderItemRepository';
import { OrderServiceFactory } from '../../orders-sync/services/order/OrderServiceFactory';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';

/**
 * Container holding the three split services.
 */
export interface ServiceContainer {
  basketService: BasketServiceInterface;
  checkoutService: CheckoutServiceInterface;
  orderSyncService: OrderSyncServiceInterface;
}

/**
 * Factory that wires up BasketService, CheckoutService and OrderSyncService
 * with their dependencies via constructor injection.
 */
export class BasketServiceFactory {
  private static instance: BasketServiceFactory;
  private container: ServiceContainer | null = null;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): BasketServiceFactory {
    if (!BasketServiceFactory.instance) {
      BasketServiceFactory.instance = new BasketServiceFactory();
    }
    return BasketServiceFactory.instance;
  }

  /**
   * Build (if needed) and initialise the service container.
   */
  public async getServices(): Promise<ServiceContainer> {
    if (!this.container) {
      this.container = this.buildContainer();
    }

    if (!this.initialized) {
      await this.container.basketService.initialize();
      this.initialized = true;
    }

    return this.container;
  }

  public getServiceSync(): BasketServiceInterface {
    if (!this.container) {
      this.container = this.buildContainer();
    }
    return this.container.basketService;
  }

  public getContainerSync(): ServiceContainer {
    if (!this.container) {
      this.container = this.buildContainer();
    }
    return this.container;
  }

  public reset(): void {
    this.container = null;
    this.initialized = false;
  }

  // ── Wiring ──────────────────────────────────────────────────────────

  private buildContainer(): ServiceContainer {
    // Repositories — factory selects the right implementation for the current mode
    const basketRepo = new BasketRepository();
    const orderRepo: OrderRepository = getOrderRepository();
    const orderItemRepo = new OrderItemRepository();

    // Shared dependencies
    const loggerFactory = LoggerFactory.getInstance();
    const orderServiceFactory = OrderServiceFactory.getInstance();

    // Build services (bottom-up dependency order)
    const basketService = new BasketService(basketRepo, loggerFactory.createLogger('BasketService'));
    const checkoutService = new CheckoutService(basketService, orderRepo, orderItemRepo, loggerFactory.createLogger('CheckoutService'));
    const orderSyncService = new OrderSyncService(
      checkoutService,
      orderRepo,
      orderServiceFactory,
      loggerFactory.createLogger('OrderSyncService')
    );

    // Inject the right return repository into RefundService
    import('../../returns/repositories/ReturnRepository').then(({ getReturnRepository }) => {
      import('../../returns/services/refunds/RefundService').then(({ returnService }) => {
        returnService.setReturnRepository(getReturnRepository());
      });
    });

    return { basketService, checkoutService, orderSyncService };
  }
}

/**
 * Convenience: get the full service container
 */
export async function getServiceContainer(): Promise<ServiceContainer> {
  return BasketServiceFactory.getInstance().getServices();
}

export function getBasketServiceSync(): BasketServiceInterface {
  return BasketServiceFactory.getInstance().getServiceSync();
}
