import { GiftCardServiceInterface } from './GiftCardServiceInterface';
import { ShopifyGiftCardService } from './platforms/ShopifyGiftCardService';
import { WooCommerceGiftCardService } from './platforms/WooCommerceGiftCardService';
import { BigCommerceGiftCardService } from './platforms/BigCommerceGiftCardService';
import { MagentoGiftCardService } from './platforms/MagentoGiftCardService';
import { SyliusGiftCardService } from './platforms/SyliusGiftCardService';
import { WixGiftCardService } from './platforms/WixGiftCardService';
import { PrestaShopGiftCardService } from './platforms/PrestaShopGiftCardService';
import { SquarespaceGiftCardService } from './platforms/SquarespaceGiftCardService';
import { ECommercePlatform, isOnlinePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Factory for creating platform-specific gift card service instances.
 * Gift cards live on the platform — the POS checks balances and redeems them.
 * Returns null for offline mode (no gift card service).
 */
export class GiftCardServiceFactory {
  private static instance: GiftCardServiceFactory;
  private logger = LoggerFactory.getInstance().createLogger('GiftCardServiceFactory');

  private services: Map<ECommercePlatform, GiftCardServiceInterface> = new Map();

  private constructor() {}

  static getInstance(): GiftCardServiceFactory {
    if (!GiftCardServiceFactory.instance) {
      GiftCardServiceFactory.instance = new GiftCardServiceFactory();
    }
    return GiftCardServiceFactory.instance;
  }

  getService(platform?: ECommercePlatform): GiftCardServiceInterface | null {
    if (!platform || !isOnlinePlatform(platform)) {
      return null;
    }

    if (this.services.has(platform)) {
      return this.services.get(platform)!;
    }

    let service: GiftCardServiceInterface | null = null;

    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        service = new ShopifyGiftCardService();
        break;
      case ECommercePlatform.WOOCOMMERCE:
        service = new WooCommerceGiftCardService();
        break;
      case ECommercePlatform.BIGCOMMERCE:
        service = new BigCommerceGiftCardService();
        break;
      case ECommercePlatform.MAGENTO:
        service = new MagentoGiftCardService();
        break;
      case ECommercePlatform.SYLIUS:
        service = new SyliusGiftCardService();
        break;
      case ECommercePlatform.WIX:
        service = new WixGiftCardService();
        break;
      case ECommercePlatform.PRESTASHOP:
        service = new PrestaShopGiftCardService();
        break;
      case ECommercePlatform.SQUARESPACE:
        service = new SquarespaceGiftCardService();
        break;
      default:
        return null;
    }

    if (service) {
      service.initialize().catch(err => {
        this.logger.error(
          { message: `Failed to initialize ${platform} gift card service` },
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

export const giftCardServiceFactory = GiftCardServiceFactory.getInstance();
