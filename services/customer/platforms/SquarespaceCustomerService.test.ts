import { SquarespaceCustomerService } from './SquarespaceCustomerService';

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

describe('SquarespaceCustomerService', () => {
  let service: SquarespaceCustomerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SquarespaceCustomerService();

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

  describe('searchCustomers', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should search customers successfully', async () => {
      const mockResponse = {
        profiles: [
          {
            id: 'profile-1',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
            orderCount: 3,
            totalOrderAmount: { value: '150.00' },
            createdOn: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: { nextPageCursor: null },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.searchCustomers({ query: 'john', limit: 10 });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        id: 'profile-1',
        platformId: 'profile-1',
        platform: ECommercePlatform.SQUARESPACE,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        orderCount: 3,
        totalSpent: 150.0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });
      expect(result.hasMore).toBe(false);
    });

    it('should filter customers by query', async () => {
      const mockResponse = {
        profiles: [
          {
            id: 'profile-1',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
          {
            id: 'profile-2',
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.searchCustomers({ query: 'john', limit: 10 });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].firstName).toBe('John');
    });
  });

  describe('getCustomer', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch customer successfully', async () => {
      const mockProfile = {
        id: 'profile-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        orderCount: 5,
        totalOrderAmount: { value: '250.00' },
        createdOn: '2024-01-01T00:00:00Z',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      } as any);

      const result = await service.getCustomer('profile-1');

      expect(result).toEqual({
        id: 'profile-1',
        platformId: 'profile-1',
        platform: ECommercePlatform.SQUARESPACE,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        orderCount: 5,
        totalSpent: 250.0,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      });
    });
  });
});
