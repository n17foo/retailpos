import { SyliusDiscountService } from './SyliusDiscountService';

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

import secretsService from '../../secrets/secretsService';
import { getPlatformToken } from '../../token/tokenUtils';
import { withTokenRefresh } from '../../token/tokenIntegration';

describe('SyliusDiscountService', () => {
  let service: SyliusDiscountService;
  const mockBaseUrl = 'https://sylius.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyliusDiscountService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'SYLIUS_BASE_URL') return Promise.resolve(mockBaseUrl);
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

    it('should validate coupon successfully', async () => {
      const mockCoupon = {
        id: 'coupon-1',
        code: 'TEST20',
        promotion: { name: 'Test Promotion' },
        used: 0,
        usageLimit: 100,
        expiresAt: '2030-01-01T00:00:00+00:00',
        enabled: true,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCoupon),
      } as any);

      const result = await service.validateCoupon('TEST20', 100, []);

      expect(result).toEqual({
        valid: true,
        description: 'Test Promotion',
        discountType: 'percentage',
        amount: 0, // Sylius uses rule-based promotions
      });
    });

    it('should handle expired coupon', async () => {
      const mockCoupon = {
        id: 'coupon-1',
        code: 'EXPIRED',
        promotion: { name: 'Expired Promotion' },
        expiresAt: '2020-01-01T00:00:00+00:00',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCoupon),
      } as any);

      const result = await service.validateCoupon('EXPIRED', 100, []);
      expect(result).toEqual({ valid: false, error: 'This coupon has expired' });
    });

    it('should handle usage limit exceeded', async () => {
      const mockCoupon = {
        id: 'coupon-1',
        code: 'USEDUP',
        promotion: { name: 'Used Up Promotion' },
        used: 10,
        usageLimit: 10,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCoupon),
      } as any);

      const result = await service.validateCoupon('USEDUP', 100, []);
      expect(result).toEqual({ valid: false, error: 'Coupon usage limit reached' });
    });
  });
});
