import { PrestaShopGiftCardService } from './PrestaShopGiftCardService';

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

describe('PrestaShopGiftCardService', () => {
  let service: PrestaShopGiftCardService;
  const mockBaseUrl = 'https://prestashop.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrestaShopGiftCardService();

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

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift card', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 1,
            code: 'TEST100',
            reduction_amount: '70.00',
            reduction_currency: 'EUR',
            active: '1',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.checkBalance('TEST100');

      expect(result).toEqual({
        code: 'TEST100',
        balance: 70,
        currency: 'EUR',
        status: 'active',
      });
    });

    it('should handle inactive gift cards', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 1,
            code: 'INACTIVE',
            reduction_amount: '40.00',
            active: '0',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.checkBalance('INACTIVE');
      expect(result.status).toBe('disabled');
    });
  });

  describe('redeemGiftCard', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should simulate redemption successfully', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 1,
            code: 'TEST100',
            reduction_amount: '100.00',
            reduction_currency: 'EUR',
            active: '1',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 15);

      expect(result).toEqual({
        success: true,
        amountDeducted: 15,
        remainingBalance: 85,
      });
    });

    it('should reject redemption when balance is insufficient', async () => {
      const mockResponse = {
        cart_rules: [
          {
            id: 1,
            code: 'TEST100',
            reduction_amount: '5.00',
            reduction_currency: 'EUR',
            active: '1',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 25);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });
});
