import { SyncServiceInterface } from './SyncServiceInterface';
import { CompositeSyncService } from './CompositeSyncService';
import { ECommercePlatform } from '../../utils/platforms';
import { ShopifySyncService } from './platforms/ShopifySyncService';
import { WooCommerceSyncService } from './platforms/WooCommerceSyncService';
import { BigCommerceSyncService } from './platforms/BigCommerceSyncService';
import { MagentoSyncService } from './platforms/MagentoSyncService';
import { SyliusSyncService } from './platforms/SyliusSyncService';
import { OfflineSyncService } from './platforms/OfflineSyncService';
import { PrestaShopSyncService } from './platforms/PrestaShopSyncService';
import { SquarespaceSyncService } from './platforms/SquarespaceSyncService';
import { CommercefullSyncService } from './platforms/CommercefullSyncService';
import { PlatformSyncConfig } from './platforms/PlatformSyncServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';
import { CommercefullWebhookReceiver } from '../clients/commercefull/CommercefullWebhookReceiver';

/**
 * Factory for creating sync service instances
 * Implements the singleton pattern
 */
export class SyncServiceFactory {
  private static instance: SyncServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('SyncServiceFactory');

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

      case ECommercePlatform.COMMERCEFULL:
        service = this.createCommercefullSyncService();
        break;

      // Magento and Sylius have dedicated (stub) sync services — use them
      case ECommercePlatform.MAGENTO:
        service = this.createMagentoSyncService();
        break;

      case ECommercePlatform.SYLIUS:
        service = this.createSyliusSyncService();
        break;

      // Wix falls back to offline sync (no dedicated implementation)
      case ECommercePlatform.WIX:
        service = this.createOfflineSyncService();
        break;

      default:
        this.logger.warn({ message: `Unknown platform: ${platform}, using offline sync service` });
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
      this.logger.error({ message: 'Failed to initialize Shopify sync service' }, err instanceof Error ? err : new Error(String(err)));
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
      apiKey: process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.WOOCOMMERCE_KEY,
      apiSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.WOOCOMMERCE_SECRET,
      webhookUrl: process.env.WOOCOMMERCE_WEBHOOK_URL,
      version: process.env.WOOCOMMERCE_API_VERSION || 'v3',
      batchSize: process.env.WOOCOMMERCE_SYNC_BATCH_SIZE ? parseInt(process.env.WOOCOMMERCE_SYNC_BATCH_SIZE, 10) : 50,
    };

    // Initialize asynchronously
    service.initialize(config).catch(err => {
      this.logger.error({ message: 'Failed to initialize WooCommerce sync service' }, err instanceof Error ? err : new Error(String(err)));
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
      this.logger.error({ message: 'Failed to initialize BigCommerce sync service' }, err instanceof Error ? err : new Error(String(err)));
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
      this.logger.error({ message: 'Failed to initialize Offline sync service' }, err instanceof Error ? err : new Error(String(err)));
    });

    return service;
  }

  /**
   * Create a Magento-specific sync service
   */
  private createMagentoSyncService(): SyncServiceInterface {
    const service = new MagentoSyncService();
    service.initialize().catch(err => {
      this.logger.error({ message: 'Failed to initialize Magento sync service' }, err instanceof Error ? err : new Error(String(err)));
    });
    return service;
  }

  /**
   * Create a Sylius-specific sync service
   */
  private createSyliusSyncService(): SyncServiceInterface {
    const service = new SyliusSyncService();
    service.initialize().catch(err => {
      this.logger.error({ message: 'Failed to initialize Sylius sync service' }, err instanceof Error ? err : new Error(String(err)));
    });
    return service;
  }

  /**
   * Create a PrestaShop-specific sync service
   */
  private createPrestaShopSyncService(): SyncServiceInterface {
    const service = new PrestaShopSyncService();

    service.initialize().catch(err => {
      this.logger.error({ message: 'Failed to initialize PrestaShop sync service' }, err instanceof Error ? err : new Error(String(err)));
    });

    return service;
  }

  /**
   * Create a Squarespace-specific sync service
   */
  private createSquarespaceSyncService(): SyncServiceInterface {
    const service = new SquarespaceSyncService();

    service.initialize().catch(err => {
      this.logger.error({ message: 'Failed to initialize Squarespace sync service' }, err instanceof Error ? err : new Error(String(err)));
    });

    return service;
  }

  private createCommercefullSyncService(): SyncServiceInterface {
    const service = new CommercefullSyncService();

    const config: PlatformSyncConfig = {
      storeUrl: process.env.COMMERCEFULL_STORE_URL,
      apiKey: process.env.COMMERCEFULL_API_KEY,
      apiSecret: process.env.COMMERCEFULL_API_SECRET,
      webhookUrl: process.env.COMMERCEFULL_WEBHOOK_URL,
    };

    service
      .initialize(config)
      .then(ok => {
        if (ok) {
          this.wireCommercefullWebhooks(service, config.webhookUrl);
        }
      })
      .catch(err => {
        this.logger.error(
          { message: 'Failed to initialize Commercefull sync service' },
          err instanceof Error ? err : new Error(String(err))
        );
      });

    return service;
  }

  /**
   * Wire the Commercefull webhook receiver to the sync service,
   * register default event listeners, and auto-register webhooks
   * on the Commercefull platform when a webhookUrl is configured.
   */
  private wireCommercefullWebhooks(service: CommercefullSyncService, webhookUrl?: string): void {
    // 1. Wire the webhook receiver singleton to this sync service
    const receiver = CommercefullWebhookReceiver.getInstance();
    receiver.setSyncService(service);

    // 2. Register default event listeners for real-time sync
    service.onWebhookEvent('product.*', async event => {
      this.logger.info({ message: `[Webhook] Product event: ${event.event}` });
      await this.handleProductWebhook(event);
    });

    service.onWebhookEvent('order.*', async event => {
      this.logger.info({ message: `[Webhook] Order event: ${event.event}` });
      await this.handleOrderWebhook(event);
    });

    service.onWebhookEvent('inventory.*', async event => {
      this.logger.info({ message: `[Webhook] Inventory event: ${event.event}` });
      await this.handleInventoryWebhook(event);
    });

    service.onWebhookEvent('customer.*', async event => {
      this.logger.info({ message: `[Webhook] Customer event: ${event.event}` });
      await this.handleCustomerWebhook(event);
    });

    // 3. Auto-register webhooks on Commercefull if webhookUrl is provided
    if (webhookUrl) {
      service
        .registerSyncWebhooks(webhookUrl)
        .then(ok => {
          if (ok) {
            this.logger.info({ message: `[Webhook] Registered Commercefull webhooks → ${webhookUrl}` });
          } else {
            this.logger.warn({ message: '[Webhook] Failed to register Commercefull webhooks' });
          }
        })
        .catch(err => {
          this.logger.error(
            { message: '[Webhook] Error registering Commercefull webhooks' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
    }
  }

  /**
   * Handle product webhook events
   * Updates local product cache/database and emits sync events
   */
  private async handleProductWebhook(event: { event: string; data: Record<string, unknown> }): Promise<void> {
    try {
      const { ProductRepository } = await import('../../repositories/ProductRepository');
      const { syncEventBus } = await import('../instoreapi/sync/SyncEventBus');
      const productRepo = new ProductRepository();

      // Parse event type (e.g., 'product.created', 'product.updated', 'product.deleted')
      const eventType = event.event.split('.')[1]; // 'created', 'updated', 'deleted'

      if (eventType === 'created' || eventType === 'updated') {
        const productData = event.data as {
          id: string;
          name: string;
          description?: string;
          price: number;
          sku?: string;
          barcode?: string;
          category_id?: string;
          stock?: number;
        };

        // Check if product exists
        const existing = await productRepo.findById(productData.id);

        if (existing) {
          // Update existing product
          await productRepo.update(productData.id, {
            name: productData.name,
            description: productData.description,
            price: productData.price,
            sku: productData.sku,
            barcode: productData.barcode,
            category_id: productData.category_id,
            stock: productData.stock,
          });
          this.logger.info({ message: `[Webhook] Updated product: ${productData.id}` });
        } else {
          // Create new product
          await productRepo.create({
            name: productData.name,
            description: productData.description,
            price: productData.price,
            sku: productData.sku,
            barcode: productData.barcode,
            category_id: productData.category_id,
            stock: productData.stock ?? 0,
          });
          this.logger.info({ message: `[Webhook] Created product: ${productData.id}` });
        }

        // Emit sync event for UI updates
        syncEventBus.emit('product:updated', { productId: productData.id });
      } else if (eventType === 'deleted') {
        const productId = (event.data.id || event.data.productId) as string;
        await productRepo.delete(productId);
        this.logger.info({ message: `[Webhook] Deleted product: ${productId}` });
        syncEventBus.emit('product:updated', { productId, deleted: true });
      }
    } catch (error) {
      this.logger.error(
        { message: `[Webhook] Error handling product event: ${event.event}` },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Handle order webhook events
   * Updates local order state and emits sync events
   */
  private async handleOrderWebhook(event: { event: string; data: Record<string, unknown> }): Promise<void> {
    try {
      const { getOrderRepository } = await import('../../repositories/OrderRepository');
      const { syncEventBus } = await import('../instoreapi/sync/SyncEventBus');
      const { generateUUID } = await import('../../utils/uuid');
      const orderRepo = getOrderRepository();

      const eventType = event.event.split('.')[1]; // 'created', 'updated', 'paid', etc.
      const orderData = event.data as {
        id?: string;
        platform?: string;
        platformOrderId?: string;
        status?: string;
        subtotal: number;
        tax: number;
        total: number;
        discountAmount?: number;
        discountCode?: string;
        customerEmail?: string;
        customerName?: string;
        note?: string;
        cashierId?: string;
        cashierName?: string;
        registerId?: string;
        paymentMethod?: string;
        transactionId?: string;
      };

      if (eventType === 'created') {
        // Order created on another register - sync to local DB
        await orderRepo.create({
          id: orderData.id || generateUUID(),
          platform: orderData.platform || null,
          platformOrderId: orderData.platformOrderId || null,
          status: orderData.status || 'pending',
          subtotal: orderData.subtotal,
          tax: orderData.tax,
          total: orderData.total,
          discountAmount: orderData.discountAmount || null,
          discountCode: orderData.discountCode || null,
          customerEmail: orderData.customerEmail || null,
          customerName: orderData.customerName || null,
          note: orderData.note || null,
          cashierId: orderData.cashierId || null,
          cashierName: orderData.cashierName || null,
          registerId: orderData.registerId || null,
        });
        this.logger.info({ message: `[Webhook] Created order: ${orderData.platformOrderId || orderData.id}` });
        syncEventBus.emit('order:created', { orderId: orderData.platformOrderId || orderData.id });
      } else if (eventType === 'updated' || eventType === 'paid') {
        // Order updated - update local state
        if (orderData.id && orderData.status) {
          await orderRepo.updateStatus(orderData.id, orderData.status);
        }
        if (orderData.id && orderData.paymentMethod) {
          await orderRepo.updatePayment(orderData.id, orderData.paymentMethod, orderData.transactionId || null);
        }
        this.logger.info({ message: `[Webhook] Updated order: ${orderData.id}` });

        const syncEventType = orderData.status === 'paid' ? 'order:paid' : 'order:updated';
        syncEventBus.emit(syncEventType, { orderId: orderData.id });
      }
    } catch (error) {
      this.logger.error(
        { message: `[Webhook] Error handling order event: ${event.event}` },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Handle inventory webhook events
   * Updates local stock levels and emits sync events
   */
  private async handleInventoryWebhook(event: { event: string; data: Record<string, unknown> }): Promise<void> {
    try {
      const { ProductRepository } = await import('../../repositories/ProductRepository');
      const { syncEventBus } = await import('../instoreapi/sync/SyncEventBus');
      const productRepo = new ProductRepository();

      const inventoryData = event.data as {
        productId?: string;
        stock?: number;
        items?: Array<{ productId: string; stock: number }>;
      };

      // Update stock level for product
      if (inventoryData.productId && inventoryData.stock !== undefined) {
        await productRepo.update(inventoryData.productId, {
          stock: inventoryData.stock,
        });
        this.logger.info({
          message: `[Webhook] Updated inventory: ${inventoryData.productId} → ${inventoryData.stock}`,
        });
        syncEventBus.emit('inventory:updated', {
          productId: inventoryData.productId,
          stock: inventoryData.stock,
        });
      }

      // Handle bulk inventory updates
      if (Array.isArray(inventoryData.items)) {
        for (const item of inventoryData.items) {
          if (item.productId && item.stock !== undefined) {
            await productRepo.update(item.productId, { stock: item.stock });
          }
        }
        this.logger.info({ message: `[Webhook] Updated ${inventoryData.items.length} inventory items` });
        syncEventBus.emit('inventory:updated', { bulk: true, count: inventoryData.items.length });
      }
    } catch (error) {
      this.logger.error(
        { message: `[Webhook] Error handling inventory event: ${event.event}` },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Handle customer webhook events
   * Updates local customer cache and emits sync events
   */
  private async handleCustomerWebhook(event: { event: string; data: Record<string, unknown> }): Promise<void> {
    try {
      const { LocalCustomerRepository } = await import('../../repositories/LocalCustomerRepository');
      const { syncEventBus } = await import('../instoreapi/sync/SyncEventBus');
      const customerRepo = new LocalCustomerRepository();

      const eventType = event.event.split('.')[1]; // 'created', 'updated', 'deleted'
      const customerData = event.data as {
        email: string;
        name?: string;
        phone?: string;
        notes?: string;
        segment?: string;
      };

      if (eventType === 'created' || eventType === 'updated') {
        // Upsert customer (creates if new, updates if exists)
        await customerRepo.upsert({
          email: customerData.email,
          name: customerData.name,
          phone: customerData.phone,
          notes: customerData.notes,
          segment: customerData.segment,
        });
        this.logger.info({ message: `[Webhook] Upserted customer: ${customerData.email}` });
        syncEventBus.emit('user:updated', { email: customerData.email });
      }
    } catch (error) {
      this.logger.error(
        { message: `[Webhook] Error handling customer event: ${event.event}` },
        error instanceof Error ? error : new Error(String(error))
      );
    }
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
          this.logger.error(
            { message: 'Failed to initialize Shopify sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        this.serviceInstances[platform] = shopifyService;
        break;
      }

      case ECommercePlatform.WOOCOMMERCE: {
        const wooService = new WooCommerceSyncService();
        wooService.initialize(config).catch(err => {
          this.logger.error(
            { message: 'Failed to initialize WooCommerce sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        this.serviceInstances[platform] = wooService;
        break;
      }

      case ECommercePlatform.BIGCOMMERCE: {
        const bigService = new BigCommerceSyncService();
        bigService.initialize(config).catch(err => {
          this.logger.error(
            { message: 'Failed to initialize BigCommerce sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
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
          this.logger.error(
            { message: 'Failed to initialize PrestaShop sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        this.serviceInstances[platform] = prestaService;
        break;
      }

      case ECommercePlatform.SQUARESPACE: {
        const squarespaceService = new SquarespaceSyncService();
        squarespaceService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Squarespace sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        this.serviceInstances[platform] = squarespaceService;
        break;
      }

      case ECommercePlatform.COMMERCEFULL: {
        const cfService = new CommercefullSyncService();
        cfService
          .initialize(config)
          .then(ok => {
            if (ok) {
              this.wireCommercefullWebhooks(cfService, config.webhookUrl);
            }
          })
          .catch(err => {
            this.logger.error(
              { message: 'Failed to initialize Commercefull sync service with config' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        this.serviceInstances[platform] = cfService;
        break;
      }

      // Magento and Sylius have dedicated sync services
      case ECommercePlatform.MAGENTO: {
        const magentoService = new MagentoSyncService();
        magentoService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Magento sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        this.serviceInstances[platform] = magentoService;
        break;
      }

      case ECommercePlatform.SYLIUS: {
        const syliusService = new SyliusSyncService();
        syliusService.initialize().catch(err => {
          this.logger.error(
            { message: 'Failed to initialize Sylius sync service with config' },
            err instanceof Error ? err : new Error(String(err))
          );
        });
        this.serviceInstances[platform] = syliusService;
        break;
      }

      // Wix falls back to offline sync
      case ECommercePlatform.WIX: {
        this.serviceInstances[platform] = new OfflineSyncService();
        break;
      }

      default:
        this.logger.warn({ message: `Unknown platform: ${platform}, not supported for sync configuration` });
        return;
    }

    // Reset composite service so it picks up new configurations
    this.compositeService = null;
  }
}
