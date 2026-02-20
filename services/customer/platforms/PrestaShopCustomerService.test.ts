import { PrestaShopCustomerService } from './PrestaShopCustomerService';

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
import { ECommercePlatform } from '../../../utils/platforms';

describe('PrestaShopCustomerService', () => {
  let service: PrestaShopCustomerService;
  const mockBaseUrl = 'https://prestashop.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrestaShopCustomerService();

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

    it('should fail initialization without base URL', async () => {
      (secretsService.getSecret as jest.Mock).mockResolvedValue(null);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('searchCustomers', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should search customers successfully', async () => {
      const mockResponse = {
        customers: [
          {
            id: 1,
            email: 'john@example.com',
            firstname: 'John',
            lastname: 'Doe',
            date_add: '2024-01-01 00:00:00',
            date_upd: '2024-01-02 00:00:00',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.searchCustomers({ query: 'john', limit: 10 });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        id: '1',
        platformId: '1',
        platform: ECommercePlatform.PRESTASHOP,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date('2024-01-01 00:00:00'),
        updatedAt: new Date('2024-01-02 00:00:00'),
      });
      expect(result.hasMore).toBe(false);
    });
  });

  describe('getCustomer', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch customer successfully', async () => {
      const mockCustomer = {
        id: 1,
        email: 'jane@example.com',
        firstname: 'Jane',
        lastname: 'Smith',
        date_add: '2024-01-01 00:00:00',
        date_upd: '2024-01-02 00:00:00',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ customer: mockCustomer }),
      } as any);

      const result = await service.getCustomer('1');

      expect(result).toEqual({
        id: '1',
        platformId: '1',
        platform: ECommercePlatform.PRESTASHOP,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        createdAt: new Date('2024-01-01 00:00:00'),
        updatedAt: new Date('2024-01-02 00:00:00'),
      });
    });
  });
});
