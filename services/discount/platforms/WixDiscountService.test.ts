import { WixDiscountService } from './WixDiscountService';

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

describe('WixDiscountService', () => {
  let service: WixDiscountService;
  const mockSiteId = 'test-site-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WixDiscountService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WIX_SITE_ID') return Promise.resolve(mockSiteId);
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

    it('should fail initialization without site ID', async () => {
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

    it('should validate coupon successfully', async () => {
      const mockResponse = {
        coupons: [
          {
            id: 'coupon-1',
            code: 'TEST20',
            name: 'Test 20% Off',
            percentOff: 20,
            active: true,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.validateCoupon('TEST20', 100, []);

      expect(result).toEqual({
        valid: true,
        description: 'Test 20% Off',
        discountType: 'percentage',
        amount: 20,
      });
    });

    it('should handle fixed amount coupons', async () => {
      const mockResponse = {
        coupons: [
          {
            id: 'coupon-2',
            code: 'FIXED10',
            name: 'Fixed $10 Off',
            moneyOffAmount: 10,
            active: true,
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
        coupons: [
          {
            id: 'coupon-3',
            code: 'INACTIVE',
            name: 'Inactive Coupon',
            active: false,
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
