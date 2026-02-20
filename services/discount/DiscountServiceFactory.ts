import { DiscountServiceInterface } from './DiscountServiceInterface';
import { ShopifyDiscountService } from './platforms/ShopifyDiscountService';
import { WooCommerceDiscountService } from './platforms/WooCommerceDiscountService';
import { BigCommerceDiscountService } from './platforms/BigCommerceDiscountService';
import { MagentoDiscountService } from './platforms/MagentoDiscountService';
import { SyliusDiscountService } from './platforms/SyliusDiscountService';
import { WixDiscountService } from './platforms/WixDiscountService';
import { PrestaShopDiscountService } from './platforms/PrestaShopDiscountService';
import { SquarespaceDiscountService } from './platforms/SquarespaceDiscountService';
import { ECommercePlatform, isOnlinePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Factory for creating platform-specific discount/coupon service instances.
 * Coupons live on the platform — the POS only validates and applies them.
 * Returns null for offline mode (no coupon service needed).
 */
export class DiscountServiceFactory {
  private static instance: DiscountServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('DiscountServiceFactory');

  private services: Map<ECommercePlatform, DiscountServiceInterface> = new Map();

  private constructor() {}

  static getInstance(): DiscountServiceFactory {
    if (!DiscountServiceFactory.instance) {
      DiscountServiceFactory.instance = new DiscountServiceFactory();
    }
    return DiscountServiceFactory.instance;
  }

  /**
   * Get a discount service for the given platform.
   * Returns null for offline or unsupported platforms.
   */
  getService(platform?: ECommercePlatform): DiscountServiceInterface | null {
    if (!platform || !isOnlinePlatform(platform)) {
      return null;
    }

    if (this.services.has(platform)) {
      return this.services.get(platform)!;
    }

    let service: DiscountServiceInterface | null = null;

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        service = new ShopifyDiscountService();
        break;
      case ECommercePlatform.WOOCOMMERCE:
        service = new WooCommerceDiscountService();
        break;
      case ECommercePlatform.BIGCOMMERCE:
        service = new BigCommerceDiscountService();
        break;
      case ECommercePlatform.MAGENTO:
        service = new MagentoDiscountService();
        break;
      case ECommercePlatform.SYLIUS:
        service = new SyliusDiscountService();
        break;
      case ECommercePlatform.WIX:
        service = new WixDiscountService();
        break;
      case ECommercePlatform.PRESTASHOP:
        service = new PrestaShopDiscountService();
        break;
      case ECommercePlatform.SQUARESPACE:
        service = new SquarespaceDiscountService();
        break;
      default:
        return null;
    }

    if (service) {
      service.initialize().catch(err => {
        this.logger.error(
          { message: `Failed to initialize ${platform} discount service` },
          err instanceof Error ? err : new Error(String(err))
        );
      });
      this.services.set(platform, service);
    }

    return service;
  }

  reset(): void {
    this.services.clear();
  }
}

export const discountServiceFactory = DiscountServiceFactory.getInstance();
