import { WooCommerceGiftCardService } from './WooCommerceGiftCardService';

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

describe('WooCommerceGiftCardService', () => {
  let service: WooCommerceGiftCardService;
  const mockStoreUrl = 'https://woocommerce.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WooCommerceGiftCardService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WOOCOMMERCE_STORE_URL') return Promise.resolve(mockStoreUrl);
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

    it('should fail initialization without store URL', async () => {
      (secretsService.getSecret as jest.Mock).mockResolvedValue(null);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift card', async () => {
      const mockResponse = [
        {
          id: 1,
          code: 'TEST100',
          balance: '50.00',
          active: true,
          expiration_date: '2025-01-01T00:00:00Z',
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.checkBalance('TEST100');

      expect(result).toEqual({
        code: 'TEST100',
        balance: 50,
        currency: 'USD',
        status: 'active',
        expiresAt: new Date('2025-01-01T00:00:00Z'),
      });
    });

    it('should return not_found for invalid gift card', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as any);

      const result = await service.checkBalance('INVALID');
      expect(result).toEqual({
        code: 'INVALID',
        balance: 0,
        currency: 'USD',
        status: 'not_found',
      });
    });

    it('should handle inactive gift cards', async () => {
      const mockResponse = [
        {
          id: 1,
          code: 'INACTIVE',
          balance: '25.00',
          active: false,
        },
      ];

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

    it('should redeem gift card successfully', async () => {
      const mockResponse = {
        balance: '40.00',
        id: 'txn-123',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 10);

      expect(result).toEqual({
        success: true,
        amountDeducted: 10,
        remainingBalance: 40,
        transactionId: 'txn-123',
      });
    });

    it('should handle redemption failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      const result = await service.redeemGiftCard('TEST100', 10);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redemption failed');
    });
  });
});
