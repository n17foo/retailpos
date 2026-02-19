import { giftCardServiceFactory } from './giftCardServiceFactory';
import { WooCommerceGiftCardService } from './platforms/WooCommerceGiftCardService';
import { BigCommerceGiftCardService } from './platforms/BigCommerceGiftCardService';
import { MagentoGiftCardService } from './platforms/MagentoGiftCardService';
import { SyliusGiftCardService } from './platforms/SyliusGiftCardService';
import { WixGiftCardService } from './platforms/WixGiftCardService';
import { PrestaShopGiftCardService } from './platforms/PrestaShopGiftCardService';
import { SquarespaceGiftCardService } from './platforms/SquarespaceGiftCardService';
import { ECommercePlatform } from '../../utils/platforms';

// Mock logger to avoid transitive expo-sqlite dependency
jest.mock('../logger/loggerFactory', () => ({
  LoggerFactory: {
    getInstance: jest.fn(() => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

// Mock all platform services
jest.mock('./platforms/ShopifyGiftCardService', () => ({
  ShopifyGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/WooCommerceGiftCardService', () => ({
  WooCommerceGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/BigCommerceGiftCardService', () => ({
  BigCommerceGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/MagentoGiftCardService', () => ({
  MagentoGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/SyliusGiftCardService', () => ({
  SyliusGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/WixGiftCardService', () => ({
  WixGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/PrestaShopGiftCardService', () => ({
  PrestaShopGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/SquarespaceGiftCardService', () => ({
  SquarespaceGiftCardService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

describe('giftCardServiceFactory', () => {
  beforeEach(() => {
    giftCardServiceFactory.reset();
  });

  describe('getService', () => {
    it('should return WooCommerceGiftCardService for WOOCOMMERCE platform', () => {
      const service = giftCardServiceFactory.getService(ECommercePlatform.WOOCOMMERCE);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return BigCommerceGiftCardService for BIGCOMMERCE platform', () => {
      const service = giftCardServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return MagentoGiftCardService for MAGENTO platform', () => {
      const service = giftCardServiceFactory.getService(ECommercePlatform.MAGENTO);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return SyliusGiftCardService for SYLIUS platform', () => {
      const service = giftCardServiceFactory.getService(ECommercePlatform.SYLIUS);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return WixGiftCardService for WIX platform', () => {
      const service = giftCardServiceFactory.getService(ECommercePlatform.WIX);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return PrestaShopGiftCardService for PRESTASHOP platform', () => {
      const service = giftCardServiceFactory.getService(ECommercePlatform.PRESTASHOP);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return null for unsupported platform', () => {
      expect(giftCardServiceFactory.getService('UNSUPPORTED_PLATFORM' as ECommercePlatform)).toBeNull();
    });

    it('should return null for offline mode', () => {
      expect(giftCardServiceFactory.getService()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear the service cache', () => {
      const service1 = giftCardServiceFactory.getService(ECommercePlatform.WOOCOMMERCE);
      giftCardServiceFactory.reset();
      const service2 = giftCardServiceFactory.getService(ECommercePlatform.WOOCOMMERCE);
      expect(service1).not.toBe(service2);
    });
  });
});
