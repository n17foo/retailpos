import { WixGiftCardService } from './WixGiftCardService';

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

describe('WixGiftCardService', () => {
  let service: WixGiftCardService;
  const mockSiteId = 'test-site-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WixGiftCardService();

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
  });

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift card', async () => {
      const mockResponse = {
        giftCard: {
          id: 'card-1',
          code: 'TEST100',
          balance: { amount: '80.00', currency: 'USD' },
          status: 'ACTIVE',
          expirationDate: '2030-01-01T00:00:00Z',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.checkBalance('TEST100');

      expect(result).toEqual({
        code: 'TEST100',
        balance: 80,
        currency: 'USD',
        status: 'active',
        expiresAt: new Date('2030-01-01T00:00:00Z'),
      });
    });

    it('should handle expired gift cards', async () => {
      const mockResponse = {
        giftCard: {
          id: 'card-1',
          code: 'EXPIRED',
          balance: { amount: '30.00', currency: 'USD' },
          status: 'EXPIRED',
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.checkBalance('EXPIRED');
      expect(result.status).toBe('disabled');
    });
  });

  describe('redeemGiftCard', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should simulate redemption successfully', async () => {
      const mockResponse = {
        giftCard: {
          id: 'card-1',
          balance: { amount: '80.00', currency: 'USD' },
        },
        transactionId: 'txn-123',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 20);

      expect(result).toEqual({
        success: true,
        amountDeducted: 20,
        remainingBalance: 80,
        transactionId: 'txn-123',
      });
    });

    it('should reject redemption when balance is insufficient', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      const result = await service.redeemGiftCard('TEST100', 50);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redemption failed');
    });
  });
});
