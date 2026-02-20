import { discountServiceFactory } from './DiscountServiceFactory';
import { BigCommerceDiscountService } from './platforms/BigCommerceDiscountService';
import { MagentoDiscountService } from './platforms/MagentoDiscountService';
import { SyliusDiscountService } from './platforms/SyliusDiscountService';
import { WixDiscountService } from './platforms/WixDiscountService';
import { PrestaShopDiscountService } from './platforms/PrestaShopDiscountService';
import { SquarespaceDiscountService } from './platforms/SquarespaceDiscountService';
import { ECommercePlatform } from '../../utils/platforms';

// Mock logger to avoid transitive expo-sqlite dependency
jest.mock('../logger/LoggerFactory', () => ({
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
jest.mock('./platforms/ShopifyDiscountService', () => ({
  ShopifyDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/WooCommerceDiscountService', () => ({
  WooCommerceDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/BigCommerceDiscountService', () => ({
  BigCommerceDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/MagentoDiscountService', () => ({
  MagentoDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/SyliusDiscountService', () => ({
  SyliusDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/WixDiscountService', () => ({
  WixDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/PrestaShopDiscountService', () => ({
  PrestaShopDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/SquarespaceDiscountService', () => ({
  SquarespaceDiscountService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

describe('discountServiceFactory', () => {
  beforeEach(() => {
    discountServiceFactory.reset();
  });

  describe('getService', () => {
    it('should return BigCommerceDiscountService for BIGCOMMERCE platform', () => {
      const service = discountServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return MagentoDiscountService for MAGENTO platform', () => {
      const service = discountServiceFactory.getService(ECommercePlatform.MAGENTO);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return SyliusDiscountService for SYLIUS platform', () => {
      const service = discountServiceFactory.getService(ECommercePlatform.SYLIUS);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return WixDiscountService for WIX platform', () => {
      const service = discountServiceFactory.getService(ECommercePlatform.WIX);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return PrestaShopDiscountService for PRESTASHOP platform', () => {
      const service = discountServiceFactory.getService(ECommercePlatform.PRESTASHOP);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return null for unsupported platform', () => {
      expect(discountServiceFactory.getService('UNSUPPORTED_PLATFORM' as ECommercePlatform)).toBeNull();
    });

    it('should return null for offline mode', () => {
      expect(discountServiceFactory.getService()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear the service cache', () => {
      const service1 = discountServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      discountServiceFactory.reset();
      const service2 = discountServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      expect(service1).not.toBe(service2);
    });
  });
});
