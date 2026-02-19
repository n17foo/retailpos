import { SquarespaceGiftCardService } from './SquarespaceGiftCardService';

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

describe('SquarespaceGiftCardService', () => {
  let service: SquarespaceGiftCardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SquarespaceGiftCardService();

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

  describe('checkBalance', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return balance for valid gift card', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'TEST100',
        balance: { value: '65.00', currency: 'USD' },
        status: 'ACTIVE',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.checkBalance('TEST100');

      expect(result).toEqual({
        code: 'TEST100',
        balance: 65,
        currency: 'USD',
        status: 'active',
      });
    });

    it('should handle redeemed gift cards', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'REDEEMED',
        balance: { value: '0.00', currency: 'USD' },
        status: 'REDEEMED',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.checkBalance('REDEEMED');
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
        balance: { value: '100.00', currency: 'USD' },
        status: 'ACTIVE',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 35);

      expect(result).toEqual({
        success: true,
        amountDeducted: 35,
        remainingBalance: 65,
      });
    });

    it('should reject redemption when balance is insufficient', async () => {
      const mockCard = {
        id: 'card-1',
        code: 'TEST100',
        balance: { value: '20.00', currency: 'USD' },
        status: 'ACTIVE',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCard),
      } as any);

      const result = await service.redeemGiftCard('TEST100', 40);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });
  });
});
