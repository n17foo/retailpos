import { OrderServiceInterface } from './OrderServiceInterface';
import { ShopifyOrderService } from './platforms/ShopifyOrderService';
import { WooCommerceOrderService } from './platforms/WooCommerceOrderService';
import { BigCommerceOrderService } from './platforms/BigCommerceOrderService';
import { MagentoOrderService } from './platforms/MagentoOrderService';
import { SyliusOrderService } from './platforms/SyliusOrderService';
import { WixOrderService } from './platforms/WixOrderService';
import { PrestaShopOrderService } from './platforms/PrestaShopOrderService';
import { SquarespaceOrderService } from './platforms/SquarespaceOrderService';
import { CommercefullOrderService } from './platforms/CommercefullOrderService';
import { OfflineOrderService } from './platforms/OfflineOrderService';
import { PlatformOrderConfig } from './platforms/PlatformOrderServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Factory for creating order service instances
 * Implements the singleton pattern
 */
export class OrderServiceFactory {
  private static instance: OrderServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('OrderServiceFactory');
  private offlineDefaultService: OrderServiceInterface;
  private shopifyService: ShopifyOrderService | null = null;
  private wooCommerceService: WooCommerceOrderService | null = null;
  private bigCommerceService: BigCommerceOrderService | null = null;
  private magentoService: MagentoOrderService | null = null;
  private syliusService: SyliusOrderService | null = null;
  private wixService: WixOrderService | null = null;
  private prestaShopService: PrestaShopOrderService | null = null;
  private squarespaceService: SquarespaceOrderService | null = null;
  private commercefullService: CommercefullOrderService | null = null;
  private offlineService: OfflineOrderService | null = null;

  private constructor() {
    this.offlineDefaultService = new OfflineOrderService();
  }

  public static getInstance(): OrderServiceFactory {
    if (!OrderServiceFactory.instance) {
      OrderServiceFactory.instance = new OrderServiceFactory();
    }
    return OrderServiceFactory.instance;
  }

  /**
   * Get an order service for a specific platform
   * @param platform The platform to get a service for
   * @param config Optional configuration for the service
   * @returns An order service for the specified platform
   */
  public getService(platform?: ECommercePlatform, config?: PlatformOrderConfig): OrderServiceInterface {
    // Determine if we should use the mock service
    if (!platform) {
      return this.offlineDefaultService;
    }

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        if (!this.shopifyService) {
          this.shopifyService = new ShopifyOrderService(config);
          this.shopifyService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Shopify order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.shopifyService;

      case ECommercePlatform.WOOCOMMERCE:
        if (!this.wooCommerceService) {
          this.wooCommerceService = new WooCommerceOrderService(config);
          this.wooCommerceService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize WooCommerce order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.wooCommerceService;

      case ECommercePlatform.BIGCOMMERCE:
        if (!this.bigCommerceService) {
          this.bigCommerceService = new BigCommerceOrderService(config);
          this.bigCommerceService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize BigCommerce order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.bigCommerceService;

      case ECommercePlatform.MAGENTO:
        if (!this.magentoService) {
          this.magentoService = new MagentoOrderService(config);
          this.magentoService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Magento order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.magentoService;

      case ECommercePlatform.SYLIUS:
        if (!this.syliusService) {
          this.syliusService = new SyliusOrderService(config);
          this.syliusService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Sylius order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.syliusService;

      case ECommercePlatform.WIX:
        if (!this.wixService) {
          this.wixService = new WixOrderService(config);
          this.wixService.initialize().catch(err => {
            this.logger.error({ message: 'Failed to initialize Wix order service:' }, err instanceof Error ? err : new Error(String(err)));
          });
        }
        return this.wixService;

      case ECommercePlatform.PRESTASHOP:
        if (!this.prestaShopService) {
          this.prestaShopService = new PrestaShopOrderService(config);
          this.prestaShopService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize PrestaShop order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.prestaShopService;

      case ECommercePlatform.SQUARESPACE:
        if (!this.squarespaceService) {
          this.squarespaceService = new SquarespaceOrderService(config);
          this.squarespaceService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Squarespace order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.squarespaceService;

      case ECommercePlatform.COMMERCEFULL:
        if (!this.commercefullService) {
          this.commercefullService = new CommercefullOrderService(config);
          this.commercefullService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Commercefull order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.commercefullService;

      case ECommercePlatform.OFFLINE:
        if (!this.offlineService) {
          this.offlineService = new OfflineOrderService(config);
          this.offlineService.initialize().catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Offline order service:' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
        return this.offlineService;

      default:
        this.logger.warn({ message: `Platform ${platform} not supported for orders, using offline order service` });
        return this.offlineDefaultService;
    }
  }

  /**
   * Initialize the mock order service with sample data
   * @returns The mock order service
   */
  public getOfflineService(): OrderServiceInterface {
    return this.offlineDefaultService;
  }

  /**
   * Configure a platform service with specific settings from storage
   * This replaces any existing cached service instance
   * @param platform The platform to configure
   * @param config The configuration from storage
   */
  public configureService(platform: ECommercePlatform, config: PlatformOrderConfig): void {
    // Clear any existing cached instance for this platform
    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        this.shopifyService = new ShopifyOrderService(config);
        this.shopifyService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Shopify order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.WOOCOMMERCE:
        this.wooCommerceService = new WooCommerceOrderService(config);
        this.wooCommerceService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize WooCommerce order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.BIGCOMMERCE:
        this.bigCommerceService = new BigCommerceOrderService(config);
        this.bigCommerceService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize BigCommerce order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.MAGENTO:
        this.magentoService = new MagentoOrderService(config);
        this.magentoService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Magento order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.SYLIUS:
        this.syliusService = new SyliusOrderService(config);
        this.syliusService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Sylius order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.WIX:
        this.wixService = new WixOrderService(config);
        this.wixService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Wix order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.PRESTASHOP:
        this.prestaShopService = new PrestaShopOrderService(config);
        this.prestaShopService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize PrestaShop order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.SQUARESPACE:
        this.squarespaceService = new SquarespaceOrderService(config);
        this.squarespaceService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Squarespace order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.COMMERCEFULL:
        this.commercefullService = new CommercefullOrderService(config);
        this.commercefullService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Commercefull order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      case ECommercePlatform.OFFLINE:
        this.offlineService = new OfflineOrderService(config);
        this.offlineService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Offline order service with config:' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        break;

      default:
        this.logger.warn({ message: `Platform ${platform} not supported for configuration` });
    }
  }
}
