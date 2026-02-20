import { MagentoGiftCardService } from './MagentoGiftCardService';

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

describe('MagentoGiftCardService', () => {
  let service: MagentoGiftCardService;
  const mockBaseUrl = 'https://magento.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MagentoGiftCardService();

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
  });

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift card', async () => {
      const mockCard = {
        id: 1,
        balance: '60.00',
        currency_code: 'USD',
        status: 0, // Active
        date_expires: '2025-01-01 00:00:00',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.checkBalance('TEST100');

      expect(result).toEqual({
        code: 'TEST100',
        balance: 60,
        currency: 'USD',
        status: 'active',
        expiresAt: new Date('2025-01-01 00:00:00'),
      });
    });

    it('should handle expired gift cards', async () => {
      const mockCard = {
        id: 1,
        balance: '20.00',
        status: 2, // Expired
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.checkBalance('EXPIRED');
      expect(result.status).toBe('expired');
    });
  });

  describe('redeemGiftCard', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should simulate redemption successfully', async () => {
      // Magento gift card redemption is handled via cart/order application
      const mockCard = {
        id: 1,
        balance: '100.00',
        status: 0,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 30);

      expect(result).toEqual({
        success: true,
        amountDeducted: 30,
        remainingBalance: 70,
      });
    });

    it('should reject redemption when balance is insufficient', async () => {
      const mockCard = {
        id: 1,
        balance: '10.00',
        status: 0,
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
