import { DiscountServiceInterface } from './DiscountServiceInterface';
import { LocalDiscountService } from './LocalDiscountService';
import { ShopifyDiscountService } from './platforms/ShopifyDiscountService';
import { ECommercePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Factory for creating discount service instances
 */
export class DiscountServiceFactory {
  private static instance: DiscountServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('DiscountServiceFactory');

  // Cache for platform-specific services
  private serviceInstances: Record<string, DiscountServiceInterface> = {};
  private localService: LocalDiscountService;

  private constructor() {
    // Initialize local service as default
    this.localService = new LocalDiscountService();
    this.localService.initialize().catch(err => {
      this.logger.error({ message: 'Failed to initialize local discount service' }, err instanceof Error ? err : new Error(String(err)));
    });
  }

  public static getInstance(): DiscountServiceFactory {
    if (!DiscountServiceFactory.instance) {
      DiscountServiceFactory.instance = new DiscountServiceFactory();
    }
    return DiscountServiceFactory.instance;
  }

  /**
   * Get a discount service for the specified platform
   * @param platform The e-commerce platform
   * @returns An appropriate discount service instance
   */
  public getService(platform?: ECommercePlatform): DiscountServiceInterface {
    // If no platform specified or offline, use local service
    if (!platform || platform === ECommercePlatform.OFFLINE) {
      return this.localService;
    }

    // Return cached instance if available
    if (this.serviceInstances[platform]) {
      return this.serviceInstances[platform];
    }

    // Create and cache a new platform-specific service
    const service = this.createPlatformDiscountService(platform);
    this.serviceInstances[platform] = service;
    return service;
  }

  /**
   * Create a platform-specific discount service
   * @param platform Platform to create a discount service for
   * @returns A platform-specific discount service
   */
  private createPlatformDiscountService(platform: ECommercePlatform): DiscountServiceInterface {
    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        return this.createShopifyDiscountService();

      // For platforms without dedicated discount API, fall back to local service
      case ECommercePlatform.WOOCOMMERCE:
      case ECommercePlatform.BIGCOMMERCE:
      case ECommercePlatform.MAGENTO:
      case ECommercePlatform.SYLIUS:
      case ECommercePlatform.WIX:
      case ECommercePlatform.PRESTASHOP:
      case ECommercePlatform.COMMERCEFULL:
      default:
        this.logger.info({
          message: `Platform ${platform} uses local discount service (no platform API available)`,
        });
        return this.localService;
    }
  }

  /**
   * Create a Shopify-specific discount service
   */
  private createShopifyDiscountService(): DiscountServiceInterface {
    const service = new ShopifyDiscountService();

    // Initialize with environment variables
    service.initialize(process.env.SHOPIFY_STORE_URL).catch(err => {
      this.logger.error({ message: 'Failed to initialize Shopify discount service' }, err instanceof Error ? err : new Error(String(err)));
    });

    return service;
  }

  /**
   * Get the local discount service (for admin/manager discount management)
   * @returns The local discount service
   */
  public getLocalService(): LocalDiscountService {
    return this.localService;
  }
}
