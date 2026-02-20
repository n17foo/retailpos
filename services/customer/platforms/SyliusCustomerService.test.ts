import { SyliusCustomerService } from './SyliusCustomerService';

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

describe('SyliusCustomerService', () => {
  let service: SyliusCustomerService;
  const mockBaseUrl = 'https://sylius.example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyliusCustomerService();

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
        'hydra:member': [
          {
            id: 'customer-1',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
            phoneNumber: '+1234567890',
            createdAt: '2024-01-01T00:00:00+00:00',
          },
        ],
        'hydra:totalItems': 1,
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.searchCustomers({ query: 'john', limit: 10 });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        id: 'customer-1',
        platformId: 'customer-1',
        platform: ECommercePlatform.SYLIUS,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        createdAt: new Date('2024-01-01T00:00:00+00:00'),
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
        id: 'customer-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        createdAt: '2024-01-01T00:00:00+00:00',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCustomer),
      } as any);

      const result = await service.getCustomer('customer-1');

      expect(result).toEqual({
        id: 'customer-1',
        platformId: 'customer-1',
        platform: ECommercePlatform.SYLIUS,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        createdAt: new Date('2024-01-01T00:00:00+00:00'),
      });
    });
  });
});
