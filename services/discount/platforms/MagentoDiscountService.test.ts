import { MagentoDiscountService } from './MagentoDiscountService';

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

describe('MagentoDiscountService', () => {
  let service: MagentoDiscountService;
  const mockBaseUrl = 'https://magento.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MagentoDiscountService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'MAGENTO_BASE_URL') return Promise.resolve(mockBaseUrl);
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

    it('should fail initialization without base URL', async () => {
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
      const mockSearchResponse = {
        items: [
          {
            coupon_id: 1,
            code: 'TEST20',
            rule_id: 100,
            is_active: true,
          },
        ],
      };

      const mockRuleResponse = {
        rule_id: 100,
        name: 'Test 20% Off',
        simple_action: 'by_percent',
        discount_amount: '20.00',
        is_active: true,
      };

      let callCount = 0;
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSearchResponse),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockRuleResponse),
          })
        );

      const result = await service.validateCoupon('TEST20', 100, []);

      expect(result).toEqual({
        valid: true,
        description: 'Test 20% Off',
        discountType: 'percentage',
        amount: 20,
      });
    });

    it('should handle invalid coupon code', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      } as any);

      const result = await service.validateCoupon('INVALID', 100, []);
      expect(result).toEqual({ valid: false, error: 'Invalid coupon code' });
    });

    it('should handle fixed amount coupons', async () => {
      const mockSearchResponse = {
        items: [{ coupon_id: 1, code: 'FIXED10', rule_id: 101, is_active: true }],
      };

      const mockRuleResponse = {
        rule_id: 101,
        name: 'Fixed $10 Off',
        simple_action: 'fixed',
        discount_amount: '10.00',
        is_active: true,
      };

      let callCount = 0;
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSearchResponse),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockRuleResponse),
          })
        );

      const result = await service.validateCoupon('FIXED10', 100, []);
      expect(result).toEqual({
        valid: true,
        description: 'Fixed $10 Off',
        discountType: 'fixed_amount',
        amount: 10,
      });
    });
  });
});
