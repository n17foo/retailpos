import { SyncServiceInterface } from './SyncServiceInterface';
import { CompositeSyncService } from './CompositeSyncService';
import { ECommercePlatform } from '../../utils/platforms';
import { ShopifySyncService } from './platforms/ShopifySyncService';
import { WooCommerceSyncService } from './platforms/WooCommerceSyncService';
import { BigCommerceSyncService } from './platforms/BigCommerceSyncService';
import { OfflineSyncService } from './platforms/OfflineSyncService';
import { PrestaShopSyncService } from './platforms/PrestaShopSyncService';
import { SquarespaceSyncService } from './platforms/SquarespaceSyncService';
import { PlatformSyncConfig } from './platforms/PlatformSyncServiceInterface';

/**
 * Factory for creating sync service instances
 * Implements the singleton pattern
 */
export class SyncServiceFactory {
  private static instance: SyncServiceFactory;

  // Cache for platform-specific services
  private serviceInstances: Record<string, SyncServiceInterface | null> = {};
  private compositeService: CompositeSyncService | null = null;
  private offlineDefaultService: OfflineSyncService;

  private constructor() {
    // Initialize offline service as default
    this.offlineDefaultService = new OfflineSyncService();
  }

  public static getInstance(): SyncServiceFactory {
    if (!SyncServiceFactory.instance) {
      SyncServiceFactory.instance = new SyncServiceFactory();
    }
    return SyncServiceFactory.instance;
  }

  /**
   * Get a sync service for the specified platform
   * @param platform The e-commerce platform to get service for
   * @returns An appropriate sync service instance
   */
  public getService(platform?: ECommercePlatform | ECommercePlatform[]): SyncServiceInterface {
    // Check if we should use the mock service

    // If no platform is specified, return a composite service with all available platforms
    if (!platform) {
      return this.getCompositeService(Object.values(ECommercePlatform));
    }

    // If an array of platforms is provided, return a composite service
    if (Array.isArray(platform)) {
      return this.getCompositeService(platform);
    }

    // Return cached instance if available
    if (this.serviceInstances[platform]) {
      return this.serviceInstances[platform]!;
    }

    // Create and cache a new platform-specific service
    const service = this.createPlatformSyncService(platform);
    this.serviceInstances[platform] = service;
    return service;
  }

  /**
   * Create a composite sync service combining multiple platform services
   * @param platforms Platforms to include in the composite service
   * @returns A composite sync service instance
   */
  private getCompositeService(platforms: ECommercePlatform[]): CompositeSyncService {
    // If we already have a composite service with the same platforms, return it
    if (this.compositeService) {
      return this.compositeService;
    }

    // Create a new composite service
    const composite = new CompositeSyncService();

    // Add platform-specific services
    platforms.forEach(platform => {
      let service: SyncServiceInterface;

      if (this.serviceInstances[platform]) {
        service = this.serviceInstances[platform]!;
      } else {
        service = this.createPlatformSyncService(platform);
        this.serviceInstances[platform] = service;
      }

      composite.addPlatformService(platform, service);
    });

    this.compositeService = composite;
    return composite;
  }

  /**
   * Create a platform-specific sync service
   * @param platform Platform to create a sync service for
   * @returns A platform-specific sync service
   */
  private createPlatformSyncService(platform: ECommercePlatform): SyncServiceInterface {
    let service: SyncServiceInterface;

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        service = this.createShopifySyncService();
        break;

      case ECommercePlatform.WOOCOMMERCE:
        service = this.createWooCommerceSyncService();
        break;

      case ECommercePlatform.BIGCOMMERCE:
        service = this.createBigCommerceSyncService();
        break;

      case ECommercePlatform.OFFLINE:
        service = this.createOfflineSyncService();
        break;

      case ECommercePlatform.PRESTASHOP:
        service = this.createPrestaShopSyncService();
        break;

      case ECommercePlatform.SQUARESPACE:
        service = this.createSquarespaceSyncService();
        break;

      // These platforms use the offline sync service (no dedicated sync implementation)
      case ECommercePlatform.MAGENTO:
      case ECommercePlatform.SYLIUS:
      case ECommercePlatform.WIX:
        service = this.createOfflineSyncService();
        break;

      default:
        console.warn(`Unknown platform: ${platform}, using offline sync service`);
        service = this.offlineDefaultService;
    }

    return service;
  }

  /**
   * Create a Shopify-specific sync service
   */
  private createShopifySyncService(): SyncServiceInterface {
    const service = new ShopifySyncService();

    // Initialize with environment variables
    const config: PlatformSyncConfig = {
      storeUrl: process.env.SHOPIFY_STORE_URL,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      apiVersion: process.env.SHOPIFY_API_VERSION,
      webhookUrl: process.env.SHOPIFY_WEBHOOK_URL,
      batchSize: process.env.SHOPIFY_SYNC_BATCH_SIZE ? parseInt(process.env.SHOPIFY_SYNC_BATCH_SIZE, 10) : 50,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize Shopify sync service:', err);
    });

    return service;
  }

  /**
   * Create a WooCommerce-specific sync service
   */
  private createWooCommerceSyncService(): SyncServiceInterface {
    const service = new WooCommerceSyncService();

    // Initialize with environment variables
    const config: PlatformSyncConfig = {
      storeUrl: process.env.WOOCOMMERCE_URL,
      apiKey: process.env.WOOCOMMERCE_KEY,
      apiSecret: process.env.WOOCOMMERCE_SECRET,
      webhookUrl: process.env.WOOCOMMERCE_WEBHOOK_URL,
      version: process.env.WOOCOMMERCE_API_VERSION || 'v3',
      batchSize: process.env.WOOCOMMERCE_SYNC_BATCH_SIZE ? parseInt(process.env.WOOCOMMERCE_SYNC_BATCH_SIZE, 10) : 50,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize WooCommerce sync service:', err);
    });

    return service;
  }

  /**
   * Create a BigCommerce-specific sync service
   */
  private createBigCommerceSyncService(): SyncServiceInterface {
    const service = new BigCommerceSyncService();

    // Initialize with environment variables
    const config: PlatformSyncConfig = {
      storeHash: process.env.BIGCOMMERCE_STORE_HASH,
      accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN,
      clientId: process.env.BIGCOMMERCE_CLIENT_ID,
      webhookUrl: process.env.BIGCOMMERCE_WEBHOOK_URL,
      batchSize: process.env.BIGCOMMERCE_SYNC_BATCH_SIZE ? parseInt(process.env.BIGCOMMERCE_SYNC_BATCH_SIZE, 10) : 50,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      console.error('Failed to initialize BigCommerce sync service:', err);
    });

    return service;
  }

  /**
   * Create an Offline-specific sync service
   */
  private createOfflineSyncService(): SyncServiceInterface {
    const service = new OfflineSyncService();

    // Offline service doesn't need configuration - it works locally
    service.initialize().catch(err => {
      console.error('Failed to initialize Offline sync service:', err);
    });

    return service;
  }

  /**
   * Create a PrestaShop-specific sync service
   */
  private createPrestaShopSyncService(): SyncServiceInterface {
    const service = new PrestaShopSyncService();

    service.initialize().catch(err => {
      console.error('Failed to initialize PrestaShop sync service:', err);
    });

    return service;
  }

  /**
   * Create a Squarespace-specific sync service
   */
  private createSquarespaceSyncService(): SyncServiceInterface {
    const service = new SquarespaceSyncService();

    service.initialize().catch(err => {
      console.error('Failed to initialize Squarespace sync service:', err);
    });

    return service;
  }

  /**
   * Configure a platform service with specific settings from storage
   * This replaces any existing cached service instance
   * @param platform The platform to configure
   * @param config The configuration from storage
   */
  public configureService(platform: ECommercePlatform, config: PlatformSyncConfig): void {
    switch (platform) {
      case ECommercePlatform.SHOPIFY: {
        const shopifyService = new ShopifySyncService();
        shopifyService.initialize(config).catch(err => {
          console.error(`Failed to initialize Shopify sync service with config:`, err);
        });
        this.serviceInstances[platform] = shopifyService;
        break;
      }

      case ECommercePlatform.WOOCOMMERCE: {
        const wooService = new WooCommerceSyncService();
        wooService.initialize(config).catch(err => {
          console.error(`Failed to initialize WooCommerce sync service with config:`, err);
        });
        this.serviceInstances[platform] = wooService;
        break;
      }

      case ECommercePlatform.BIGCOMMERCE: {
        const bigService = new BigCommerceSyncService();
        bigService.initialize(config).catch(err => {
          console.error(`Failed to initialize BigCommerce sync service with config:`, err);
        });
        this.serviceInstances[platform] = bigService;
        break;
      }

      case ECommercePlatform.OFFLINE: {
        // Offline service doesn't use configuration - just initialize it
        this.serviceInstances[platform] = new OfflineSyncService();
        break;
      }

      case ECommercePlatform.PRESTASHOP: {
        const prestaService = new PrestaShopSyncService();
        prestaService.initialize().catch(err => {
          console.error(`Failed to initialize PrestaShop sync service with config:`, err);
        });
        this.serviceInstances[platform] = prestaService;
        break;
      }

      case ECommercePlatform.SQUARESPACE: {
        const squarespaceService = new SquarespaceSyncService();
        squarespaceService.initialize().catch(err => {
          console.error(`Failed to initialize Squarespace sync service with config:`, err);
        });
        this.serviceInstances[platform] = squarespaceService;
        break;
      }

      // These platforms use the offline sync service (no dedicated sync implementation)
      case ECommercePlatform.MAGENTO:
      case ECommercePlatform.SYLIUS:
      case ECommercePlatform.WIX: {
        this.serviceInstances[platform] = new OfflineSyncService();
        break;
      }

      default:
        console.warn(`Unknown platform: ${platform}, not supported for sync configuration`);
        return;
    }

    // Reset composite service so it picks up new configurations
    this.compositeService = null;
  }
}
