import { BasketService } from './BasketService';
import { BasketServiceInterface } from './BasketServiceInterface';
import { CheckoutService } from '../checkout/CheckoutService';
import { CheckoutServiceInterface } from '../checkout/CheckoutServiceInterface';
import { OrderSyncService } from '../sync/OrderSyncService';
import { OrderSyncServiceInterface } from '../sync/OrderSyncServiceInterface';
import { BasketRepository } from '../../repositories/BasketRepository';
import { OrderRepository } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { OrderServiceFactory } from '../order/orderServiceFactory';
import { LoggerFactory } from '../logger/loggerFactory';

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

  /**
   * Convenience — returns only the BasketService (backward-compat).
   */
  public async getService(): Promise<BasketServiceInterface> {
    const { basketService } = await this.getServices();
    return basketService;
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
    // Repositories
    const basketRepo = new BasketRepository();
    const orderRepo = new OrderRepository();
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

    return { basketService, checkoutService, orderSyncService };
  }
}

/**
 * Convenience: get the full service container
 */
export async function getServiceContainer(): Promise<ServiceContainer> {
  return BasketServiceFactory.getInstance().getServices();
}

/**
 * Convenience: get just the basket service (backward-compat)
 */
export async function getBasketService(): Promise<BasketServiceInterface> {
  return BasketServiceFactory.getInstance().getService();
}

export function getBasketServiceSync(): BasketServiceInterface {
  return BasketServiceFactory.getInstance().getServiceSync();
}
