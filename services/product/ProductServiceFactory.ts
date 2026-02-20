import { ProductServiceInterface } from './ProductServiceInterface';
import { ShopifyProductService } from './platforms/ShopifyProductService';
import { WooCommerceProductService } from './platforms/WooCommerceProductService';
import { BigCommerceProductService } from './platforms/BigCommerceProductService';
import { MagentoProductService } from './platforms/MagentoProductService';
import { SyliusProductService } from './platforms/SyliusProductService';
import { WixProductService } from './platforms/WixProductService';
import { PrestaShopProductService } from './platforms/PrestaShopProductService';
import { SquarespaceProductService } from './platforms/SquarespaceProductService';
import { CompositeProductService } from './platforms/CompositeProductService';
import { OfflineProductService } from './platforms/OfflineProductService';
import { PlatformProductConfig, PlatformProductServiceInterface } from './platforms/PlatformProductServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Factory for creating product service instances
 * Implements the singleton pattern
 */
export class ProductServiceFactory {
  private static instance: ProductServiceFactory;
  private offlineDefaultService: ProductServiceInterface;
  private shopifyService: ShopifyProductService | null = null;
  private wooCommerceService: WooCommerceProductService | null = null;
  private bigCommerceService: BigCommerceProductService | null = null;
  private magentoService: MagentoProductService | null = null;
  private syliusService: SyliusProductService | null = null;
  private wixService: WixProductService | null = null;
  private prestaShopService: PrestaShopProductService | null = null;
  private squarespaceService: SquarespaceProductService | null = null;
  private offlineService: OfflineProductService | null = null;
  private compositeService: CompositeProductService | null = null;

  private constructor() {
    this.offlineDefaultService = new OfflineProductService();
  }

  public static getInstance(): ProductServiceFactory {
    if (!ProductServiceFactory.instance) {
      ProductServiceFactory.instance = new ProductServiceFactory();
    }
    return ProductServiceFactory.instance;
  }

  /**
   * Get a product service for a specific platform
   * @param platform The platform to get a service for
   * @param config Optional configuration for the service
   * @returns A product service for the specified platform
   */
  public getService(platform?: ECommercePlatform, config?: PlatformProductConfig): ProductServiceInterface {
    // Determine if we should use the mock service
    if (!platform) {
      return this.offlineDefaultService;
    }

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        if (!this.shopifyService) {
          this.shopifyService = new ShopifyProductService(config);
          this.shopifyService.initialize().catch(err => {
            console.error('Failed to initialize Shopify product service:', err);
          });
        }
        return this.shopifyService;

      case ECommercePlatform.WOOCOMMERCE:
        if (!this.wooCommerceService) {
          this.wooCommerceService = new WooCommerceProductService(config);
          this.wooCommerceService.initialize().catch(err => {
            console.error('Failed to initialize WooCommerce product service:', err);
          });
        }
        return this.wooCommerceService;

      case ECommercePlatform.BIGCOMMERCE:
        if (!this.bigCommerceService) {
          this.bigCommerceService = new BigCommerceProductService(config);
          this.bigCommerceService.initialize().catch(err => {
            console.error('Failed to initialize BigCommerce product service:', err);
          });
        }
        return this.bigCommerceService;

      case ECommercePlatform.MAGENTO:
        if (!this.magentoService) {
          this.magentoService = new MagentoProductService(config);
          this.magentoService.initialize().catch(err => {
            console.error('Failed to initialize Magento product service:', err);
          });
        }
        return this.magentoService;

      case ECommercePlatform.SYLIUS:
        if (!this.syliusService) {
          this.syliusService = new SyliusProductService(config);
          this.syliusService.initialize().catch(err => {
            console.error('Failed to initialize Sylius product service:', err);
          });
        }
        return this.syliusService;

      case ECommercePlatform.WIX:
        if (!this.wixService) {
          this.wixService = new WixProductService(config);
          this.wixService.initialize().catch(err => {
            console.error('Failed to initialize Wix product service:', err);
          });
        }
        return this.wixService;

      case ECommercePlatform.PRESTASHOP:
        if (!this.prestaShopService) {
          this.prestaShopService = new PrestaShopProductService(config);
          this.prestaShopService.initialize().catch(err => {
            console.error('Failed to initialize PrestaShop product service:', err);
          });
        }
        return this.prestaShopService;

      case ECommercePlatform.SQUARESPACE:
        if (!this.squarespaceService) {
          this.squarespaceService = new SquarespaceProductService(config);
          this.squarespaceService.initialize().catch(err => {
            console.error('Failed to initialize Squarespace product service:', err);
          });
        }
        return this.squarespaceService;

      case ECommercePlatform.OFFLINE:
        if (!this.offlineService) {
          this.offlineService = new OfflineProductService(config);
          this.offlineService.initialize().catch(err => {
            console.error('Failed to initialize Offline product service:', err);
          });
        }
        return this.offlineService;

      default:
        console.warn(`Platform ${platform} not supported, using offline product service`);
        return this.offlineDefaultService;
    }
  }

  /**
   * Get a composite product service that combines results from multiple platforms
   * @param platforms List of platforms to include in the composite
   * @param configs Optional configurations for each platform
   * @returns A composite product service
   */
  public getCompositeService(
    platforms: ECommercePlatform[] = [],
    configs: Partial<Record<ECommercePlatform, PlatformProductConfig>> = {}
  ): ProductServiceInterface {
    // Create a new composite service if it doesn't exist
    if (!this.compositeService) {
      this.compositeService = new CompositeProductService();
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
      if (service instanceof OfflineProductService) {
        return;
      }

      // Add the service to the composite
      if (this.compositeService) {
        this.compositeService.addService(service as unknown as PlatformProductServiceInterface);
      }
    });

    return this.compositeService;
  }

  /**
   * Initialize the mock product service with sample data
   * @returns The mock product service
   */
  public getOfflineService(): ProductServiceInterface {
    return this.offlineDefaultService;
  }

  /**
   * Configure a platform service with specific settings from storage
   * This replaces any existing cached service instance
   * @param platform The platform to configure
   * @param config The configuration from storage
   */
  public configureService(platform: ECommercePlatform, config: PlatformProductConfig): void {
    // Clear any existing cached instance for this platform
    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        this.shopifyService = new ShopifyProductService(config);
        this.shopifyService.initialize().catch(err => {
          console.error('Failed to initialize Shopify product service with config:', err);
        });
        break;

      case ECommercePlatform.WOOCOMMERCE:
        this.wooCommerceService = new WooCommerceProductService(config);
        this.wooCommerceService.initialize().catch(err => {
          console.error('Failed to initialize WooCommerce product service with config:', err);
        });
        break;

      case ECommercePlatform.BIGCOMMERCE:
        this.bigCommerceService = new BigCommerceProductService(config);
        this.bigCommerceService.initialize().catch(err => {
          console.error('Failed to initialize BigCommerce product service with config:', err);
        });
        break;

      case ECommercePlatform.MAGENTO:
        this.magentoService = new MagentoProductService(config);
        this.magentoService.initialize().catch(err => {
          console.error('Failed to initialize Magento product service with config:', err);
        });
        break;

      case ECommercePlatform.SYLIUS:
        this.syliusService = new SyliusProductService(config);
        this.syliusService.initialize().catch(err => {
          console.error('Failed to initialize Sylius product service with config:', err);
        });
        break;

      case ECommercePlatform.WIX:
        this.wixService = new WixProductService(config);
        this.wixService.initialize().catch(err => {
          console.error('Failed to initialize Wix product service with config:', err);
        });
        break;

      case ECommercePlatform.PRESTASHOP:
        this.prestaShopService = new PrestaShopProductService(config);
        this.prestaShopService.initialize().catch(err => {
          console.error('Failed to initialize PrestaShop product service with config:', err);
        });
        break;

      case ECommercePlatform.SQUARESPACE:
        this.squarespaceService = new SquarespaceProductService(config);
        this.squarespaceService.initialize().catch(err => {
          console.error('Failed to initialize Squarespace product service with config:', err);
        });
        break;

      case ECommercePlatform.OFFLINE:
        this.offlineService = new OfflineProductService(config);
        this.offlineService.initialize().catch(err => {
          console.error('Failed to initialize Offline product service with config:', err);
        });
        break;

      default:
        console.warn(`Platform ${platform} not supported for configuration`);
    }

    // Reset composite service so it picks up new configurations
    this.compositeService = null;
  }
}
