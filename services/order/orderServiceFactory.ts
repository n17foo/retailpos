import { OrderServiceInterface, Order } from './OrderServiceInterface';
import { MockOrderService } from './mock/MockOrderService';
import { ShopifyOrderService } from './platforms/ShopifyOrderService';
import { WooCommerceOrderService } from './platforms/WooCommerceOrderService';
import { BigCommerceOrderService } from './platforms/BigCommerceOrderService';
import { MagentoOrderService } from './platforms/MagentoOrderService';
import { SyliusOrderService } from './platforms/SyliusOrderService';
import { WixOrderService } from './platforms/WixOrderService';
import { PrestaShopOrderService } from './platforms/PrestaShopOrderService';
import { SquarespaceOrderService } from './platforms/SquarespaceOrderService';
import { CustomOrderService } from './platforms/CustomOrderService';
import { PlatformOrderConfig } from './platforms/PlatformOrderServiceInterface';
import { CompositeOrderService } from './platforms/CompositeOrderService';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Factory for creating order service instances
 * Implements the singleton pattern
 */
export class OrderServiceFactory {
  private static instance: OrderServiceFactory;
  private mockService: OrderServiceInterface;
  private shopifyService: ShopifyOrderService | null = null;
  private wooCommerceService: WooCommerceOrderService | null = null;
  private bigCommerceService: BigCommerceOrderService | null = null;
  private magentoService: MagentoOrderService | null = null;
  private syliusService: SyliusOrderService | null = null;
  private wixService: WixOrderService | null = null;
  private prestaShopService: PrestaShopOrderService | null = null;
  private squarespaceService: SquarespaceOrderService | null = null;
  private customService: CustomOrderService | null = null;
  private compositeService: CompositeOrderService | null = null;

  private constructor() {
    this.mockService = new MockOrderService();
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
    if (process.env.USE_MOCK_ORDER === 'true' || !platform) {
      return this.mockService;
    }

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        if (!this.shopifyService) {
          this.shopifyService = new ShopifyOrderService(config);
          this.shopifyService.initialize().catch(err => {
            console.error('Failed to initialize Shopify order service:', err);
          });
        }
        return this.shopifyService;

      case ECommercePlatform.WOOCOMMERCE:
        if (!this.wooCommerceService) {
          this.wooCommerceService = new WooCommerceOrderService(config);
          this.wooCommerceService.initialize().catch(err => {
            console.error('Failed to initialize WooCommerce order service:', err);
          });
        }
        return this.wooCommerceService;

      case ECommercePlatform.BIGCOMMERCE:
        if (!this.bigCommerceService) {
          this.bigCommerceService = new BigCommerceOrderService(config);
          this.bigCommerceService.initialize().catch(err => {
            console.error('Failed to initialize BigCommerce order service:', err);
          });
        }
        return this.bigCommerceService;

      case ECommercePlatform.MAGENTO:
        if (!this.magentoService) {
          this.magentoService = new MagentoOrderService(config);
          this.magentoService.initialize().catch(err => {
            console.error('Failed to initialize Magento order service:', err);
          });
        }
        return this.magentoService;

      case ECommercePlatform.SYLIUS:
        if (!this.syliusService) {
          this.syliusService = new SyliusOrderService(config);
          this.syliusService.initialize().catch(err => {
            console.error('Failed to initialize Sylius order service:', err);
          });
        }
        return this.syliusService;

      case ECommercePlatform.WIX:
        if (!this.wixService) {
          this.wixService = new WixOrderService(config);
          this.wixService.initialize().catch(err => {
            console.error('Failed to initialize Wix order service:', err);
          });
        }
        return this.wixService;

      case ECommercePlatform.PRESTASHOP:
        if (!this.prestaShopService) {
          this.prestaShopService = new PrestaShopOrderService(config);
          this.prestaShopService.initialize().catch(err => {
            console.error('Failed to initialize PrestaShop order service:', err);
          });
        }
        return this.prestaShopService;

      case ECommercePlatform.SQUARESPACE:
        if (!this.squarespaceService) {
          this.squarespaceService = new SquarespaceOrderService(config);
          this.squarespaceService.initialize().catch(err => {
            console.error('Failed to initialize Squarespace order service:', err);
          });
        }
        return this.squarespaceService;

      case ECommercePlatform.CUSTOM:
        if (!this.customService) {
          this.customService = new CustomOrderService(config);
          this.customService.initialize().catch(err => {
            console.error('Failed to initialize Custom order service:', err);
          });
        }
        return this.customService;

      default:
        console.warn(`Platform ${platform} not supported for orders, using mock order service`);
        return this.mockService;
    }
  }

  /**
   * Get a composite order service that combines results from multiple platforms
   * @param platforms List of platforms to include in the composite
   * @param configs Optional configurations for each platform
   * @returns A composite order service
   */
  public getCompositeService(
    platforms: ECommercePlatform[] = [],
    configs: Partial<Record<ECommercePlatform, PlatformOrderConfig>> = {}
  ): OrderServiceInterface {
    // Create a new composite service if it doesn't exist
    if (!this.compositeService) {
      this.compositeService = new CompositeOrderService();
    }

    // If no platforms specified, use all available platforms
    if (platforms.length === 0) {
      platforms = Object.values(ECommercePlatform);
    }

    // Add each platform service to the composite
    platforms.forEach(platform => {
      const config = configs[platform] || {};
      const service = this.getService(platform, config);

      // Don't add mock service to composite unless explicitly requested
      if (service instanceof MockOrderService && process.env.USE_MOCK_ORDER !== 'true') {
        return;
      }

      // Add the service to the composite
      if (this.compositeService) {
        this.compositeService.addService(service as any);
      }
    });

    return this.compositeService;
  }

  /**
   * Initialize the mock order service with sample data
   * @returns The mock order service
   */
  public getMockService(): OrderServiceInterface {
    return this.mockService;
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
          console.error('Failed to initialize Shopify order service with config:', err);
        });
        break;

      case ECommercePlatform.WOOCOMMERCE:
        this.wooCommerceService = new WooCommerceOrderService(config);
        this.wooCommerceService.initialize().catch(err => {
          console.error('Failed to initialize WooCommerce order service with config:', err);
        });
        break;

      case ECommercePlatform.BIGCOMMERCE:
        this.bigCommerceService = new BigCommerceOrderService(config);
        this.bigCommerceService.initialize().catch(err => {
          console.error('Failed to initialize BigCommerce order service with config:', err);
        });
        break;

      case ECommercePlatform.MAGENTO:
        this.magentoService = new MagentoOrderService(config);
        this.magentoService.initialize().catch(err => {
          console.error('Failed to initialize Magento order service with config:', err);
        });
        break;

      case ECommercePlatform.SYLIUS:
        this.syliusService = new SyliusOrderService(config);
        this.syliusService.initialize().catch(err => {
          console.error('Failed to initialize Sylius order service with config:', err);
        });
        break;

      case ECommercePlatform.WIX:
        this.wixService = new WixOrderService(config);
        this.wixService.initialize().catch(err => {
          console.error('Failed to initialize Wix order service with config:', err);
        });
        break;

      case ECommercePlatform.PRESTASHOP:
        this.prestaShopService = new PrestaShopOrderService(config);
        this.prestaShopService.initialize().catch(err => {
          console.error('Failed to initialize PrestaShop order service with config:', err);
        });
        break;

      case ECommercePlatform.SQUARESPACE:
        this.squarespaceService = new SquarespaceOrderService(config);
        this.squarespaceService.initialize().catch(err => {
          console.error('Failed to initialize Squarespace order service with config:', err);
        });
        break;

      case ECommercePlatform.CUSTOM:
        this.customService = new CustomOrderService(config);
        this.customService.initialize().catch(err => {
          console.error('Failed to initialize Custom order service with config:', err);
        });
        break;

      default:
        console.warn(`Platform ${platform} not supported for configuration`);
    }

    // Reset composite service so it picks up new configurations
    this.compositeService = null;
  }
}
