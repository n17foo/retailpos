import { PrestaShopDiscountService } from './PrestaShopDiscountService';

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

describe('PrestaShopDiscountService', () => {
  let service: PrestaShopDiscountService;
  const mockBaseUrl = 'https://prestashop.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrestaShopDiscountService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'PRESTASHOP_BASE_URL') return Promise.resolve(mockBaseUrl);
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
  });

  describe('validateCoupon', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should validate percentage coupon successfully', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 1,
            code: 'PERCENT20',
            name: '20% Off',
            active: '1',
            reduction_percent: '20.00',
            reduction_amount: '0.00',
            date_to: '2030-01-01 00:00:00',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('PERCENT20', 100, []);

      expect(result).toEqual({
        valid: true,
        description: '20% Off',
        discountType: 'percentage',
        amount: 20,
      });
    });

    it('should validate fixed amount coupon successfully', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 2,
            code: 'FIXED10',
            name: 'Fixed $10 Off',
            active: '1',
            reduction_percent: '0.00',
            reduction_amount: '10.00',
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

    it('should handle inactive coupon', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 3,
            code: 'INACTIVE',
            name: 'Inactive Coupon',
            active: '0',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('INACTIVE', 100, []);
      expect(result).toEqual({ valid: false, error: 'This coupon is inactive' });
    });

    it('should handle expired coupon', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 4,
            code: 'EXPIRED',
            name: 'Expired Coupon',
            active: '1',
            date_to: '2020-01-01 00:00:00',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('EXPIRED', 100, []);
      expect(result).toEqual({ valid: false, error: 'This coupon has expired' });
    });
  });
});
