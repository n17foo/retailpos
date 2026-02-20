import { CategoryServiceInterface } from './CategoryServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';
import { ShopifyCategoryService } from './platforms/ShopifyCategoryService';
import { WooCommerceCategoryService } from './platforms/WooCommerceCategoryService';
import { BigCommerceCategoryService } from './platforms/BigCommerceCategoryService';
import { CompositeCategoryService } from './platforms/CompositeCategoryService';
import { PlatformCategoryConfig, PlatformCategoryServiceInterface } from './platforms/PlatformCategoryServiceInterface';
import { OfflineCategoryService, offlineCategoryService } from './platforms/OfflineCategoryService';
import { PrestaShopCategoryService } from './platforms/PrestaShopCategoryService';
import { SquarespaceCategoryService } from './platforms/SquarespaceCategoryService';
import { MagentoCategoryService } from './platforms/MagentoCategoryService';
import { SyliusCategoryService } from './platforms/SyliusCategoryService';
import { WixCategoryService } from './platforms/WixCategoryService';

/**
 * Factory for creating category service instances
 * Implements the singleton pattern
 */
export class CategoryServiceFactory {
  private static instance: CategoryServiceFactory;
  private offlineDefaultService: CategoryServiceInterface;

  // Cache for platform-specific services
  private serviceInstances: Record<string, CategoryServiceInterface | null> = {
    [ECommercePlatform.SHOPIFY]: null,
    [ECommercePlatform.WOOCOMMERCE]: null,
    [ECommercePlatform.BIGCOMMERCE]: null,
    [ECommercePlatform.MAGENTO]: null,
    [ECommercePlatform.SYLIUS]: null,
    [ECommercePlatform.WIX]: null,
    [ECommercePlatform.PRESTASHOP]: null,
    [ECommercePlatform.SQUARESPACE]: null,
    [ECommercePlatform.OFFLINE]: null,
  };

  private constructor() {
    this.offlineDefaultService = new OfflineCategoryService();
  }

  public static getInstance(): CategoryServiceFactory {
    if (!CategoryServiceFactory.instance) {
      CategoryServiceFactory.instance = new CategoryServiceFactory();
    }
    return CategoryServiceFactory.instance;
  }

  /**
   * Get a category service for the specified platform
   * @param platform The e-commerce platform to get service for
   * @returns An appropriate category service instance
   */
  public getService(platform?: ECommercePlatform | ECommercePlatform[]): CategoryServiceInterface {
    // Check if we should use the mock service
    if (!platform) {
      return this.offlineDefaultService;
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
    let service: CategoryServiceInterface;

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

      case ECommercePlatform.OFFLINE:
        service = this.createOfflineService();
        break;

      default:
        console.warn(`Unknown platform: ${platform}, using offline category service`);
        return this.offlineDefaultService;
    }

    // Cache the instance
    this.serviceInstances[platform] = service;
    return service;
  }

  /**
   * Create a composite category service combining multiple platform services
   */
  private getCompositeService(platforms: ECommercePlatform[]): CategoryServiceInterface {
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
          case ECommercePlatform.OFFLINE:
            service = this.createOfflineService();
            break;
          default:
            return null;
        }

        if (service) {
          this.serviceInstances[platform] = service;
        }
        return service;
      })
      .filter(Boolean) as PlatformCategoryServiceInterface[];

    // Include mock service if no valid platform services
    if (services.length === 0) {
      services.push(this.offlineDefaultService as unknown as PlatformCategoryServiceInterface);
    }

    return new CompositeCategoryService(services);
  }

  /**
   * Create and initialize a Shopify category service
   */
  private createShopifyService(): CategoryServiceInterface {
    const service = new ShopifyCategoryService();

    // Initialize with environment variables
    const config: PlatformCategoryConfig = {
      storeUrl: process.env.SHOPIFY_STORE_URL,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      apiVersion: process.env.SHOPIFY_API_VERSION,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize Shopify category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a WooCommerce category service
   */
  private createWooCommerceService(): CategoryServiceInterface {
    const service = new WooCommerceCategoryService();

    // Initialize with environment variables
    const config: PlatformCategoryConfig = {
      storeUrl: process.env.WOOCOMMERCE_URL,
      apiKey: process.env.WOOCOMMERCE_KEY,
      apiSecret: process.env.WOOCOMMERCE_SECRET,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize WooCommerce category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a BigCommerce category service
   */
  private createBigCommerceService(): CategoryServiceInterface {
    const service = new BigCommerceCategoryService();

    // Initialize with environment variables
    const config: PlatformCategoryConfig = {
      storeHash: process.env.BIGCOMMERCE_STORE_HASH,
      accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN,
      clientId: process.env.BIGCOMMERCE_CLIENT_ID,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize BigCommerce category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Magento category service
   */
  private createMagentoService(): CategoryServiceInterface {
    const service = new MagentoCategoryService();

    // Initialize asynchronously
    service.getCategories().catch(err => {
      console.error('Failed to initialize Magento category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Sylius category service
   */
  private createSyliusService(): CategoryServiceInterface {
    const service = new SyliusCategoryService();

    // Initialize asynchronously
    service.getCategories().catch(err => {
      console.error('Failed to initialize Sylius category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Wix category service
   */
  private createWixService(): CategoryServiceInterface {
    const service = new WixCategoryService();

    // Initialize asynchronously
    service.getCategories().catch(err => {
      console.error('Failed to initialize Wix category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a PrestaShop category service
   */
  private createPrestaShopService(): CategoryServiceInterface {
    const service = new PrestaShopCategoryService();

    // Initialize asynchronously
    service.getCategories().catch(err => {
      console.error('Failed to initialize PrestaShop category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize a Squarespace category service
   */
  private createSquarespaceService(): CategoryServiceInterface {
    const service = new SquarespaceCategoryService();

    // Initialize asynchronously
    service.getCategories().catch(err => {
      console.error('Failed to initialize Squarespace category service:', err);
    });

    return service;
  }

  /**
   * Create and initialize an Offline category service
   */
  private createOfflineService(): CategoryServiceInterface {
    const service = offlineCategoryService;
    service.initialize().catch(err => {
      console.error('Failed to initialize Offline category service:', err);
    });
    return service;
  }
}
