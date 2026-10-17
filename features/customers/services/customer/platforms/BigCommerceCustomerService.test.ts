// Mock the dependencies before importing anything
jest.mock('../../../../../shared/services/secrets/SecretsService', () => {
  const mockGetSecret = jest.fn();
  return {
    secretsServiceFactory: {
      getService: jest.fn(() => ({
        getSecret: mockGetSecret,
      })),
    },
    __mockGetSecret: mockGetSecret,
  };
});

jest.mock('../../../../platform-clients/services/token/TokenUtils', () => ({
  getPlatformToken: jest.fn(),
}));

jest.mock('../../../../platform-clients/services/token/TokenInitializer', () => ({
  TokenInitializer: {
    getInstance: jest.fn(() => ({
      initializePlatformToken: jest.fn().mockResolvedValue(true),
    })),
  },
}));

jest.mock('../../../../platform-clients/services/token/TokenIntegration', () => ({
  withTokenRefresh: jest.fn((platform, fn) => fn()),
}));

jest.mock('../../../../../shared/services/logger/LoggerFactory', () => ({
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

// Now import after mocks are set up
import { BigCommerceCustomerService } from './BigCommerceCustomerService';
import { ECommercePlatform } from '../../../../../shared/utils/platforms';
import { getPlatformToken } from '../../../../platform-clients/services/token/TokenUtils';

const mockSecretsService = require('../../../../../shared/services/secrets/SecretsService');
const mockGetSecret = mockSecretsService.__mockGetSecret;

describe('BigCommerceCustomerService', () => {
  let service: BigCommerceCustomerService;
  const mockStoreHash = 'test-store-hash';
  const mockApiClient = {
    isInitialized: jest.fn(),
    configure: jest.fn(),
    initialize: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BigCommerceCustomerService();
    (service as unknown as { apiClient: typeof mockApiClient }).apiClient = mockApiClient;

    // Setup default mocks
    mockGetSecret.mockImplementation((key: string) => {
      if (key === 'BIGCOMMERCE_STORE_HASH') return Promise.resolve(mockStoreHash);
      return Promise.resolve(null);
    });

    (getPlatformToken as jest.Mock).mockResolvedValue('test-token');
    mockApiClient.isInitialized.mockReturnValue(true);
    mockApiClient.initialize.mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
    });

    it('should fail initialization without store hash', async () => {
      mockGetSecret.mockResolvedValue(null);
      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
    });

    it('should fail initialization if API client initialization fails', async () => {
      mockApiClient.isInitialized.mockReturnValue(false);
      mockApiClient.initialize.mockRejectedValue(new Error('init failed'));

      const result = await service.initialize();
      expect(result).toBe(false);
      expect(service.isInitialized()).toBe(false);
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

      mockApiClient.get.mockResolvedValue(mockResponse);

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
      mockApiClient.get.mockRejectedValue(new Error('API error'));

      const result = await service.searchCustomers({ query: 'test' });
      expect(result).toEqual({ customers: [], hasMore: false });
    });

    it('should handle network errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));
      const result = await service.searchCustomers({ query: 'test' });
      expect(result).toEqual({ customers: [], hasMore: false });
    });
  });

  describe('getAuthHeaders', () => {
    it('should return proper auth headers', async () => {
      await service.initialize();
      const headers = await (service as unknown as { getAuthHeaders: () => Promise<Record<string, string>> }).getAuthHeaders();
      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'X-Auth-Token': 'test-token',
      });
    });
  });
});
