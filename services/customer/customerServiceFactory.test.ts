import { customerServiceFactory } from './CustomerServiceFactory';
import { BigCommerceCustomerService } from './platforms/BigCommerceCustomerService';
import { MagentoCustomerService } from './platforms/MagentoCustomerService';
import { SyliusCustomerService } from './platforms/SyliusCustomerService';
import { WixCustomerService } from './platforms/WixCustomerService';
import { PrestaShopCustomerService } from './platforms/PrestaShopCustomerService';
import { SquarespaceCustomerService } from './platforms/SquarespaceCustomerService';
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
jest.mock('./platforms/ShopifyCustomerService', () => ({
  ShopifyCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/WooCommerceCustomerService', () => ({
  WooCommerceCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/BigCommerceCustomerService', () => ({
  BigCommerceCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/MagentoCustomerService', () => ({
  MagentoCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/SyliusCustomerService', () => ({
  SyliusCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/WixCustomerService', () => ({
  WixCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/PrestaShopCustomerService', () => ({
  PrestaShopCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

jest.mock('./platforms/SquarespaceCustomerService', () => ({
  SquarespaceCustomerService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
  })),
}));

describe('customerServiceFactory', () => {
  beforeEach(() => {
    // Clear the factory cache before each test
    customerServiceFactory.reset();
  });

  describe('getService', () => {
    it('should return BigCommerceCustomerService for BIGCOMMERCE platform', () => {
      const service = customerServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return MagentoCustomerService for MAGENTO platform', () => {
      const service = customerServiceFactory.getService(ECommercePlatform.MAGENTO);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return SyliusCustomerService for SYLIUS platform', () => {
      const service = customerServiceFactory.getService(ECommercePlatform.SYLIUS);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return WixCustomerService for WIX platform', () => {
      const service = customerServiceFactory.getService(ECommercePlatform.WIX);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return PrestaShopCustomerService for PRESTASHOP platform', () => {
      const service = customerServiceFactory.getService(ECommercePlatform.PRESTASHOP);
      expect(service).not.toBeNull();
      expect(service!.initialize).toBeDefined();
    });

    it('should return null for unsupported platform', () => {
      expect(customerServiceFactory.getService('UNSUPPORTED_PLATFORM' as ECommercePlatform)).toBeNull();
    });

    it('should return null for offline mode', () => {
      expect(customerServiceFactory.getService()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear the service cache', () => {
      const service1 = customerServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      customerServiceFactory.reset();
      const service2 = customerServiceFactory.getService(ECommercePlatform.BIGCOMMERCE);
      expect(service1).not.toBe(service2);
    });
  });
});
