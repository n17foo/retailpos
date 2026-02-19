import { SquarespaceDiscountService } from './SquarespaceDiscountService';

// Mock the dependencies
jest.mock('../../secrets/secretsService', () => ({
  __esModule: true,
  default: {
    getSecret: jest.fn(),
  },
}));

jest.mock('../../token/tokenUtils', () => ({
  getPlatformToken: jest.fn(),
}));

jest.mock('../../token/tokenInitializer', () => ({
  TokenInitializer: {
    getInstance: jest.fn(() => ({
      initializePlatformToken: jest.fn().mockResolvedValue(true),
    })),
  },
}));

jest.mock('../../token/tokenIntegration', () => ({
  withTokenRefresh: jest.fn(),
}));

jest.mock('../../logger/loggerFactory', () => ({
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

import { getPlatformToken } from '../../token/tokenUtils';
import { withTokenRefresh } from '../../token/tokenIntegration';

describe('SquarespaceDiscountService', () => {
  let service: SquarespaceDiscountService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SquarespaceDiscountService();

    (getPlatformToken as jest.Mock).mockResolvedValue('test-token');
    (withTokenRefresh as jest.Mock).mockImplementation(async (platform, fn) => fn());
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
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
        discounts: [
          {
            id: 'discount-1',
            promoCode: 'PERCENT20',
            name: '20% Off',
            type: 'PERCENTAGE',
            percentage: 20,
            enabled: true,
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
        discounts: [
          {
            id: 'discount-2',
            promoCode: 'FIXED10',
            name: 'Fixed $10 Off',
            type: 'FIXED',
            amount: { value: '10.00' },
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

    it('should handle inactive coupon', async () => {
      const mockResponse = {
        discounts: [
          {
            id: 'discount-3',
            promoCode: 'INACTIVE',
            name: 'Inactive Coupon',
            enabled: false,
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
  });
});
