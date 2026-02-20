import { BigCommerceCustomerService } from './BigCommerceCustomerService';

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

import { getPlatformToken } from '../../token/TokenUtils';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { ECommercePlatform } from '../../../utils/platforms';
import secretsService from '../../secrets/SecretsService';

describe('BigCommerceCustomerService', () => {
  let service: BigCommerceCustomerService;
  const mockStoreHash = 'test-store-hash';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BigCommerceCustomerService();

    // Setup default mocks
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

    it('should fail initialization without store hash', async () => {
      (secretsService.getSecret as jest.Mock).mockResolvedValue(null);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    });

    it('should fail initialization if token initialization fails', async () => {
      const mockTokenInit = TokenInitializer.getInstance as jest.Mock;
      mockTokenInit.mockReturnValue({
        initializePlatformToken: jest.fn().mockResolvedValue(false),
      });

      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);

      // Restore the default mock so subsequent tests aren't affected
      mockTokenInit.mockReturnValue({
        initializePlatformToken: jest.fn().mockResolvedValue(true),
      });
    });
  });

  describe('searchCustomers', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return empty result when not initialized', async () => {
      service = new BigCommerceCustomerService(); // Not initialized
      const result = await service.searchCustomers({ query: 'test' });
      expect(result).toEqual({ customers: [], hasMore: false });
    });

    it('should search customers successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            email: 'john@example.com',
            first_name: 'John',
            last_name: 'Doe',
            orders_count: 5,
            total_spent: '150.00',
            date_created: '2024-01-01T00:00:00Z',
          },
        ],
        meta: { pagination: { total_pages: 1, current_page: 1 } },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map([['X-WP-TotalPages', '1']]),
      } as any);

      const result = await service.searchCustomers({ query: 'john', limit: 10 });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        id: '1',
        platformId: '1',
        platform: ECommercePlatform.BIGCOMMERCE,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        orderCount: 5,
        totalSpent: 150,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: undefined,
      });
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const result = await service.searchCustomers({ query: 'test' });
      expect(result).toEqual({ customers: [], hasMore: false });
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      const result = await service.searchCustomers({ query: 'test' });
      expect(result).toEqual({ customers: [], hasMore: false });
    });
  });

  describe('getCustomer', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return null when not initialized', async () => {
      service = new BigCommerceCustomerService(); // Not initialized
      const result = await service.getCustomer('1');
      expect(result).toBeNull();
    });

    it('should fetch customer successfully', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            email: 'jane@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            phone: '+1234567890',
            date_created: '2024-01-01T00:00:00Z',
            date_modified: '2024-01-02T00:00:00Z',
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await service.getCustomer('1');

      expect(result).toEqual({
        id: '1',
        platformId: '1',
        platform: ECommercePlatform.BIGCOMMERCE,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1234567890',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      });
    });

    it('should return null for non-existent customer', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as any);

      const result = await service.getCustomer('999');
      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      const result = await service.getCustomer('1');
      expect(result).toBeNull();
    });
  });

  describe('getAuthHeaders', () => {
    it('should return proper auth headers', async () => {
      await service.initialize();
      const headers = await (service as any).getAuthHeaders();
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'X-Auth-Token': 'test-token',
      });
    });
  });
});
