import { RefundServiceInterface } from './RefundServiceInterface';
import { PlatformRefundServiceInterface } from './platforms/PlatformRefundServiceInterface';

// Import platform-specific refund services
import { ShopifyRefundService } from './platforms/shopifyRefundService';
import { WooCommerceRefundService } from './platforms/wooCommerceRefundService';
import { MagentoRefundService } from './platforms/magentoRefundService';
import { BigCommerceRefundService } from './platforms/bigCommerceRefundService';
import { SyliusRefundService } from './platforms/syliusRefundService';
import { WixRefundService } from './platforms/wixRefundService';
import { OfflineRefundService } from './platforms/OfflineRefundService';
import { PrestaShopRefundService } from './platforms/PrestaShopRefundService';
import { SquarespaceRefundService } from './platforms/SquarespaceRefundService';
import { LoggerFactory } from '../logger/LoggerFactory';
import { RefundData, RefundRecord, RefundResult } from './RefundServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';

/**
 * Enum for refund service types
 */
export enum RefundServiceType {
  STANDARD = 'standard',
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  MAGENTO = 'magento',
  BIGCOMMERCE = 'bigcommerce',
  SYLIUS = 'sylius',
  WIX = 'wix',
  OFFLINE = 'offline',
}

/**
 * Factory for creating refund service instances
 * Implements the singleton pattern
 */
export class RefundServiceFactory {
  private static instance: RefundServiceFactory;
  private offlineDefaultService: RefundServiceInterface | null = null;
  private platformServices: Map<ECommercePlatform, PlatformRefundServiceInterface> = new Map();
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('RefundServiceFactory');
  }

  /**
   * Get the singleton instance of the factory
   * @returns The singleton instance
   */
  public static getInstance(): RefundServiceFactory {
    if (!RefundServiceFactory.instance) {
      RefundServiceFactory.instance = new RefundServiceFactory();
    }
    return RefundServiceFactory.instance;
  }

  /**
   * Get the default refund service (mock implementation)
   * @returns A refund service implementation
   */
  public getService(): RefundServiceInterface {
    if (!this.offlineDefaultService) {
      // Use offline implementation as default, wrapped in adapter
      const offlineService = new OfflineRefundService();
      this.offlineDefaultService = this.createPlatformServiceAdapter(offlineService, ECommercePlatform.OFFLINE);
    }
    return this.offlineDefaultService;
  }

  /**
   * Get a platform-specific refund service for the given platform
   * @param platform The e-commerce platform
   * @returns The platform-specific refund service
   */
  public getPlatformService(platform: ECommercePlatform): PlatformRefundServiceInterface | null {
    if (!this.platformServices.has(platform)) {
      let service: PlatformRefundServiceInterface | null = null;

      switch (platform) {
        case ECommercePlatform.SHOPIFY:
          service = new ShopifyRefundService();
          break;
        case ECommercePlatform.WOOCOMMERCE:
          service = new WooCommerceRefundService();
          break;
        case ECommercePlatform.MAGENTO:
          service = new MagentoRefundService();
          break;
        case ECommercePlatform.BIGCOMMERCE:
          service = new BigCommerceRefundService();
          break;
        case ECommercePlatform.SYLIUS:
          service = new SyliusRefundService();
          break;
        case ECommercePlatform.WIX:
          service = new WixRefundService();
          break;
        case ECommercePlatform.OFFLINE:
          service = new OfflineRefundService();
          break;
        case ECommercePlatform.PRESTASHOP:
          service = new PrestaShopRefundService();
          break;
        case ECommercePlatform.SQUARESPACE:
          service = new SquarespaceRefundService();
          break;
        default:
          return null;
      }

      if (service) {
        this.platformServices.set(platform, service);
      }
    }

    return this.platformServices.get(platform) || null;
  }

  /**
   * Initialize the refund service and all platform-specific services
   * @returns Promise resolving to true if initialization was successful
   */
  public async initialize(): Promise<boolean> {
    const standardResult = await this.getService().initialize();

    // Return true if standard service initialized successfully
    // Platform-specific services may fail, but that's ok
    return standardResult;
  }

  /**
   * Initialize a platform-specific refund service
   * @param platform The e-commerce platform
   * @returns Promise resolving to true if initialization was successful
   */
  private async initPlatformService(platform: ECommercePlatform): Promise<boolean> {
    try {
      const service = this.getPlatformService(platform);
      if (service) {
        return await service.initialize();
      }
    } catch (error) {
      this.logger.error(`Error initializing refund service for ${platform}:`, error);
    }
    return false;
  }

  /**
   * Convenience function to get the refund service instance
   * Will throw an error if the service is not initialized
   */
  public static getRefundService(): RefundServiceInterface {
    return RefundServiceFactory.getInstance().getService();
  }

  /**
   * Get the appropriate refund service based on configuration
   * @param platform The e-commerce platform to use if available
   * @returns The appropriate refund service for the given platform
   */
  /**
   * Create an adapter for a platform-specific refund service to match the RefundServiceInterface
   * @param platformService The platform service to adapt
   * @param platform The platform name for logging
   * @returns A RefundServiceInterface implementation wrapping the platform service
   */
  private createPlatformServiceAdapter(
    platformService: PlatformRefundServiceInterface,
    platform: ECommercePlatform
  ): RefundServiceInterface {
    return {
      initialize: () => platformService.initialize(),

      isInitialized: () => platformService.isInitialized(),

      // Map processEcommerceRefund to platform's processRefund
      processEcommerceRefund: (orderId: string, refundData: RefundData): Promise<RefundResult> => {
        this.logger.info(`Processing e-commerce refund through ${platform} platform service`);
        return platformService.processRefund(orderId, refundData);
      },

      // Payment refunds aren't directly supported by platform services
      // This is a limitation that could be addressed in a more comprehensive implementation
      processPaymentRefund: async (transactionId: string, amount: number, reason?: string): Promise<RefundResult> => {
        this.logger.warn(`Payment refund not directly supported by ${platform} platform service, using standard service`);
        return this.getService().processPaymentRefund(transactionId, amount, reason);
      },

      getRefundHistory: (orderId: string): Promise<RefundRecord[]> => {
        return platformService.getRefundHistory(orderId);
      },
    };
  }

  /**
   * Get the appropriate refund service based on configuration
   * @param platform The e-commerce platform to use if available
   * @returns The appropriate refund service for the given platform
   */
  public getRefundServiceForPlatform(platform?: ECommercePlatform): RefundServiceInterface {
    if (platform) {
      const platformService = this.getPlatformService(platform);
      if (platformService) {
        this.logger.info(`Using ${platform} platform-specific refund service`);
        // Create an adapter that implements RefundServiceInterface using the platform service
        return this.createPlatformServiceAdapter(platformService, platform);
      }
      this.logger.warn(`Platform ${platform} refund service not available, falling back to standard refund service`);
    }

    this.logger.info('Using standard refund service');
    return this.getService();
  }

  /**
   * Configure a platform service with specific settings from storage
   * @param platform The platform to configure
   * @param config The configuration from storage
   */
  public configureService(platform: ECommercePlatform, _config: Record<string, unknown>): void {
    // Get or create the platform service - this ensures the service is created
    const service = this.getPlatformService(platform);
    if (service) {
      // Platform refund services are initialized via getPlatformService
      // Config is stored for future use if needed
      this.logger.info(`Refund service configured for ${platform}`);
    }
  }
}

/**
 * Convenience function to get the refund service instance
 * Will throw an error if the service is not initialized
 */
export function getRefundService(): RefundServiceInterface {
  return RefundServiceFactory.getInstance().getService();
}

/**
 * Get the appropriate refund service based on configuration
 * @param platform The e-commerce platform to use if available
 * @returns The appropriate refund service for the given platform
 */
export function getRefundServiceForPlatform(platform?: ECommercePlatform): RefundServiceInterface {
  return RefundServiceFactory.getInstance().getRefundServiceForPlatform(platform);
}
