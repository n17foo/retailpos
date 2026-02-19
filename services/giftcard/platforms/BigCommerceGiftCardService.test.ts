import { BigCommerceGiftCardService } from './BigCommerceGiftCardService';

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

describe('BigCommerceGiftCardService', () => {
  let service: BigCommerceGiftCardService;
  const mockStoreHash = 'test-store-hash';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BigCommerceGiftCardService();

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
  });

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift certificate', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'TEST100',
            balance: '75.00',
            status: 'active',
            expiry_date: '2025-01-01T00:00:00Z',
            currency_code: 'USD',
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
        balance: 75,
        currency: 'USD',
        status: 'active',
        expiresAt: new Date('2025-01-01T00:00:00Z'),
      });
    });

    it('should return not_found for invalid gift certificate', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as any);

      const result = await service.checkBalance('INVALID');
      expect(result).toEqual({
        code: 'INVALID',
        balance: 0,
        currency: 'USD',
        status: 'not_found',
      });
    });
  });

  describe('redeemGiftCard', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should simulate redemption successfully', async () => {
      // BigCommerce doesn't have a direct redeem endpoint
      // This service simulates redemption by checking balance first
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'TEST100',
            balance: '100.00',
            status: 'active',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 25);

      expect(result).toEqual({
        success: true,
        amountDeducted: 25,
        remainingBalance: 75,
      });
    });

    it('should reject redemption when balance is insufficient', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            code: 'TEST100',
            balance: '10.00',
            status: 'active',
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
