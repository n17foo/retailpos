import { InventoryServiceInterface } from './InventoryServiceInterface';
import { MockInventoryService } from './mock/MockInventoryService';
import { ShopifyInventoryService } from './platforms/ShopifyInventoryService';
import { WooCommerceInventoryService } from './platforms/WooCommerceInventoryService';
import { BigCommerceInventoryService } from './platforms/BigCommerceInventoryService';
import { MagentoInventoryService } from './platforms/MagentoInventoryService';
import { SyliusInventoryService } from './platforms/SyliusInventoryService';
import { WixInventoryService } from './platforms/WixInventoryService';
import { PrestaShopInventoryService } from './platforms/PrestaShopInventoryService';
import { SquarespaceInventoryService } from './platforms/SquarespaceInventoryService';
import { CustomInventoryService } from './platforms/CustomInventoryService';
import { CompositeInventoryService } from './platforms/CompositeInventoryService';
import { PlatformInventoryConfig, PlatformInventoryServiceInterface } from './platforms/PlatformInventoryServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Factory for creating inventory service instances
 * Implements the singleton pattern
 */
export class InventoryServiceFactory {
  private static instance: InventoryServiceFactory;
  private mockService: InventoryServiceInterface;

  // Cache for platform-specific services
  private serviceInstances: Record<string, InventoryServiceInterface | null> = {
    [ECommercePlatform.SHOPIFY]: null,
    [ECommercePlatform.WOOCOMMERCE]: null,
    [ECommercePlatform.BIGCOMMERCE]: null,
    [ECommercePlatform.MAGENTO]: null,
    [ECommercePlatform.SYLIUS]: null,
    [ECommercePlatform.WIX]: null,
    [ECommercePlatform.PRESTASHOP]: null,
    [ECommercePlatform.SQUARESPACE]: null,
    [ECommercePlatform.CUSTOM]: null,
  };

  private constructor() {
    this.mockService = new MockInventoryService();
  }

  public static getInstance(): InventoryServiceFactory {
    if (!InventoryServiceFactory.instance) {
      InventoryServiceFactory.instance = new InventoryServiceFactory();
    }
    return InventoryServiceFactory.instance;
  }

  /**
   * Get an inventory service for the specified platform
   * @param platform The e-commerce platform to get service for
   * @returns An appropriate inventory service instance
   */
  public getService(platform?: ECommercePlatform | ECommercePlatform[]): InventoryServiceInterface {
    // Check if we should use the mock service
    if (process.env.USE_MOCK_INVENTORY === 'true' || !platform) {
      return this.mockService;
    }

    // If an array of platforms is provided, return a composite service
    if (Array.isArray(platform)) {
      return this.getCompositeService(platform);
    }

    // Return cached instance if available
    if (this.serviceInstances[platform]) {
      return this.serviceInstances[platform]!;
    }

    // Create a new instance based on platform
    let service: InventoryServiceInterface;

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        service = this.createShopifyService();
        break;

      case ECommercePlatform.WOOCOMMERCE:
        service = this.createWooCommerceService();
        break;

      case ECommercePlatform.BIGCOMMERCE:
        service = this.createBigCommerceService();
        break;

      case ECommercePlatform.MAGENTO:
        service = this.createMagentoService();
        break;

      case ECommercePlatform.SYLIUS:
        service = this.createSyliusService();
        break;

      case ECommercePlatform.WIX:
        service = this.createWixService();
        break;

      case ECommercePlatform.PRESTASHOP:
        service = this.createPrestaShopService();
        break;

      case ECommercePlatform.SQUARESPACE:
        service = this.createSquarespaceService();
        break;

      case ECommercePlatform.CUSTOM:
        service = this.createCustomService();
        break;

      default:
        console.warn(`Unknown platform: ${platform}, using mock inventory service`);
        return this.mockService;
    }

    // Cache the instance
    this.serviceInstances[platform] = service;
    return service;
  }

  /**
   * Create a composite inventory service combining multiple platform services
   */
  private getCompositeService(platforms: ECommercePlatform[]): InventoryServiceInterface {
    // Create services for each specified platform
    const services = platforms
      .map(platform => {
        if (platform && this.serviceInstances[platform]) {
          return this.serviceInstances[platform]!;
        }

        let service;
        switch (platform) {
          case ECommercePlatform.SHOPIFY:
            service = this.createShopifyService();
            break;
          case ECommercePlatform.WOOCOMMERCE:
            service = this.createWooCommerceService();
            break;
          case ECommercePlatform.BIGCOMMERCE:
            service = this.createBigCommerceService();
            break;
          case ECommercePlatform.MAGENTO:
            service = this.createMagentoService();
            break;
          case ECommercePlatform.SYLIUS:
            service = this.createSyliusService();
            break;
          case ECommercePlatform.WIX:
            service = this.createWixService();
            break;
          case ECommercePlatform.PRESTASHOP:
            service = this.createPrestaShopService();
            break;
          case ECommercePlatform.SQUARESPACE:
            service = this.createSquarespaceService();
            break;
          case ECommercePlatform.CUSTOM:
            service = this.createCustomService();
            break;
          default:
            return null;
        }

        if (service) {
          this.serviceInstances[platform] = service;
        }
        return service;
      })
      .filter(Boolean) as InventoryServiceInterface[];

    // Include mock service if no valid platform services
    if (services.length === 0) {
      services.push(this.mockService);
    }

    return new CompositeInventoryService(services as PlatformInventoryServiceInterface[]);
  }

  /**
   * Create and initialize a Shopify inventory service
   */
  private createShopifyService(): InventoryServiceInterface {
    const service = new ShopifyInventoryService();

    // Initialize with environment variables
    const config: PlatformInventoryConfig = {
      storeUrl: process.env.SHOPIFY_STORE_URL,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      apiVersion: process.env.SHOPIFY_API_VERSION,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize Shopify inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a WooCommerce inventory service
   */
  private createWooCommerceService(): InventoryServiceInterface {
    const service = new WooCommerceInventoryService();

    // Initialize with environment variables
    const config: PlatformInventoryConfig = {
      storeUrl: process.env.WOOCOMMERCE_URL,
      apiKey: process.env.WOOCOMMERCE_KEY,
      apiSecret: process.env.WOOCOMMERCE_SECRET,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize WooCommerce inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a BigCommerce inventory service
   */
  private createBigCommerceService(): InventoryServiceInterface {
    const service = new BigCommerceInventoryService();

    // Initialize with environment variables
    const config: PlatformInventoryConfig = {
      storeHash: process.env.BIGCOMMERCE_STORE_HASH,
      accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN,
      clientId: process.env.BIGCOMMERCE_CLIENT_ID,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize BigCommerce inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Magento inventory service
   */
  private createMagentoService(): InventoryServiceInterface {
    const service = new MagentoInventoryService();

    const config: PlatformInventoryConfig = {
      storeUrl: process.env.MAGENTO_STORE_URL,
      username: process.env.MAGENTO_USERNAME,
      password: process.env.MAGENTO_PASSWORD,
      accessToken: process.env.MAGENTO_ACCESS_TOKEN,
    };

    service.initialize(config).catch(err => {
      console.error('Failed to initialize Magento inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Sylius inventory service
   */
  private createSyliusService(): InventoryServiceInterface {
    const service = new SyliusInventoryService();

    const config: PlatformInventoryConfig = {
      apiUrl: process.env.SYLIUS_API_URL,
      apiKey: process.env.SYLIUS_API_KEY,
      apiSecret: process.env.SYLIUS_API_SECRET,
      accessToken: process.env.SYLIUS_ACCESS_TOKEN,
    };

    service.initialize(config).catch(err => {
      console.error('Failed to initialize Sylius inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Wix inventory service
   */
  private createWixService(): InventoryServiceInterface {
    const service = new WixInventoryService();

    const config: PlatformInventoryConfig = {
      apiKey: process.env.WIX_API_KEY,
      siteId: process.env.WIX_SITE_ID,
      accountId: process.env.WIX_ACCOUNT_ID,
    };

    service.initialize(config).catch(err => {
      console.error('Failed to initialize Wix inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a PrestaShop inventory service
   */
  private createPrestaShopService(): InventoryServiceInterface {
    const service = new PrestaShopInventoryService();

    const config: PlatformInventoryConfig = {
      storeUrl: process.env.PRESTASHOP_STORE_URL,
      apiKey: process.env.PRESTASHOP_API_KEY,
    };

    service.initialize(config).catch(err => {
      console.error('Failed to initialize PrestaShop inventory service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Squarespace inventory service
   */
  private createSquarespaceService(): InventoryServiceInterface {
    const service = new SquarespaceInventoryService();

    const config: PlatformInventoryConfig = {
      apiKey: process.env.SQUARESPACE_API_KEY,
      siteId: process.env.SQUARESPACE_SITE_ID,
    };

    service.initialize(config).catch(err => {
      console.error('Failed to initialize Squarespace inventory service:', err);
    });

    return service;
  }

  private createCustomService(): InventoryServiceInterface {
    return new CustomInventoryService();
  }

  /**
   * Configure a platform service with specific settings from storage
   * This replaces any existing cached service instance
   * @param platform The platform to configure
   * @param config The configuration from storage
   */
  public configureService(platform: ECommercePlatform, config: PlatformInventoryConfig): void {
    let service: PlatformInventoryServiceInterface | null = null;

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        service = new ShopifyInventoryService();
        break;

      case ECommercePlatform.WOOCOMMERCE:
        service = new WooCommerceInventoryService();
        break;

      case ECommercePlatform.BIGCOMMERCE:
        service = new BigCommerceInventoryService();
        break;

      case ECommercePlatform.MAGENTO:
        service = new MagentoInventoryService();
        break;

      case ECommercePlatform.SYLIUS:
        service = new SyliusInventoryService();
        break;

      case ECommercePlatform.WIX:
        service = new WixInventoryService();
        break;

      case ECommercePlatform.PRESTASHOP:
        service = new PrestaShopInventoryService();
        break;

      case ECommercePlatform.SQUARESPACE:
        service = new SquarespaceInventoryService();
        break;

      case ECommercePlatform.CUSTOM:
        // Custom service doesn't use configuration - just initialize it
        this.serviceInstances[platform] = new CustomInventoryService();
        return;

      default:
        console.warn(`Platform ${platform} not supported for inventory configuration`);
        return;
    }

    if (service) {
      service.initialize(config).catch(err => {
        console.error(`Failed to initialize ${platform} inventory service with config:`, err);
      });
      this.serviceInstances[platform] = service;
    }
  }
}
