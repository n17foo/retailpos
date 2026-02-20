import { BigCommerceDiscountService } from './BigCommerceDiscountService';

// Mock the dependencies
jest.mock('../../secrets/SecretsService', () => ({
  __esModule: true,
  default: {
    getSecret: jest.fn(),
  },
}));

jest.mock('../../token/TokenUtils', () => ({
  getPlatformToken: jest.fn(),
}));

jest.mock('../../token/TokenInitializer', () => ({
  TokenInitializer: {
    getInstance: jest.fn(() => ({
      initializePlatformToken: jest.fn().mockResolvedValue(true),
    })),
  },
}));

jest.mock('../../token/TokenIntegration', () => ({
  withTokenRefresh: jest.fn(),
}));

jest.mock('../../logger/LoggerFactory', () => ({
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

import secretsService from '../../secrets/SecretsService';
import { getPlatformToken } from '../../token/TokenUtils';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { BasketItem } from '../../../services/basket/basket';

describe('BigCommerceDiscountService', () => {
  let service: BigCommerceDiscountService;
  const mockStoreHash = 'test-store-hash';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BigCommerceDiscountService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'BIGCOMMERCE_STORE_HASH') return Promise.resolve(mockStoreHash);
      return Promise.resolve(null);
    });

    (getPlatformToken as jest.Mock).mockResolvedValue('test-token');
    (withTokenRefresh as jest.Mock).mockImplementation(async (platform, fn) => fn());
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
    });

    it('should fail initialization without store hash', async () => {
      (secretsService.getSecret as jest.Mock).mockResolvedValue(null);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('validateCoupon', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return error when not initialized', async () => {
      service = new BigCommerceDiscountService(); // Not initialized
      const result = await service.validateCoupon('TEST10', 100, []);
      expect(result).toEqual({ valid: false, error: 'Discount service not initialized' });
    });

    it('should validate coupon successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'TEST10',
            name: 'Test Coupon',
            type: 'percentage',
            amount: '10.00',
            enabled: true,
            min_purchase: '50.00',
            max_uses: 100,
            num_uses: 5,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('TEST10', 100, []);

      expect(result).toEqual({
        valid: true,
        description: 'Test Coupon',
        discountType: 'percentage',
        amount: 10,
        minimumOrderTotal: 50,
      });
    });

    it('should handle invalid coupon code', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as any);

      const result = await service.validateCoupon('INVALID', 100, []);
      expect(result).toEqual({ valid: false, error: 'Invalid coupon code' });
    });

    it('should handle disabled coupon', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'DISABLED',
            name: 'Disabled Coupon',
            enabled: false,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('DISABLED', 100, []);
      expect(result).toEqual({ valid: false, error: 'This coupon is disabled' });
    });

    it('should handle usage limit exceeded', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'USEDUP',
            name: 'Used Up Coupon',
            enabled: true,
            max_uses: 10,
            num_uses: 10,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('USEDUP', 100, []);
      expect(result).toEqual({ valid: false, error: 'Coupon usage limit reached' });
    });

    it('should handle minimum purchase requirement', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'MIN50',
            name: 'Minimum $50',
            type: 'percentage',
            amount: '10.00',
            enabled: true,
            min_purchase: '50.00',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('MIN50', 30, []);
      expect(result).toEqual({
        valid: false,
        error: 'Minimum purchase of 50 required',
        minimumOrderTotal: 50,
      });
    });

    it('should handle fixed amount coupons', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'FIXED10',
            name: 'Fixed $10 Off',
            type: 'fixed',
            amount: '10.00',
            enabled: true,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('FIXED10', 100, []);
      expect(result).toEqual({
        valid: true,
        description: 'Fixed $10 Off',
        discountType: 'fixed_amount',
        amount: 10,
      });
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const result = await service.validateCoupon('TEST', 100, []);
      expect(result).toEqual({ valid: false, error: 'Failed to validate coupon' });
    });
  });

  describe('calculateDiscount', () => {
    it('should calculate percentage discount correctly', () => {
      const validation = {
        valid: true,
        discountType: 'percentage' as const,
        amount: 15,
      };
      const basketTotal = 200;
      const items: BasketItem[] = [];

      const result = service.calculateDiscount(validation, basketTotal, items);
      expect(result).toBe(30); // 15% of 200
    });

    it('should calculate fixed amount discount correctly', () => {
      const validation = {
        valid: true,
        discountType: 'fixed_amount' as const,
        amount: 25,
      };
      const basketTotal = 200;
      const items: BasketItem[] = [];

      const result = service.calculateDiscount(validation, basketTotal, items);
      expect(result).toBe(25);
    });

    it('should not exceed basket total', () => {
      const validation = {
        valid: true,
        discountType: 'fixed_amount' as const,
        amount: 300,
      };
      const basketTotal = 200;
      const items: BasketItem[] = [];

      const result = service.calculateDiscount(validation, basketTotal, items);
      expect(result).toBe(200);
    });

    it('should return 0 for invalid validation', () => {
      const validation = { valid: false };
      const result = service.calculateDiscount(validation, 100, []);
      expect(result).toBe(0);
    });
  });
});
