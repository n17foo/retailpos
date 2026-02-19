import { SyliusGiftCardService } from './SyliusGiftCardService';

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
import secretsService from '../../secrets/secretsService';

describe('SyliusGiftCardService', () => {
  let service: SyliusGiftCardService;
  const mockBaseUrl = 'https://sylius.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyliusGiftCardService();

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

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift card', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'TEST100',
        amount: 100,
        currencyCode: 'USD',
        enabled: true,
        expiresAt: '2025-01-01T00:00:00+00:00',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.checkBalance('TEST100');

      expect(result).toEqual({
        code: 'TEST100',
        balance: 100,
        currency: 'USD',
        status: 'active',
        expiresAt: new Date('2025-01-01T00:00:00+00:00'),
      });
    });

    it('should handle disabled gift cards', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'DISABLED',
        amount: 50,
        enabled: false,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.checkBalance('DISABLED');
      expect(result.status).toBe('disabled');
    });
  });

  describe('redeemGiftCard', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should simulate redemption successfully', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'TEST100',
        amount: 100,
        enabled: true,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 25);

      expect(result).toEqual({
        success: true,
        amountDeducted: 25,
        remainingBalance: 75,
      });
    });

    it('should reject redemption when balance is insufficient', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'TEST100',
        amount: 10,
        enabled: true,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 50);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });
});
