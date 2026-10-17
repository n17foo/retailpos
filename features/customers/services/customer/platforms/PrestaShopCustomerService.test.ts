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
import { PrestaShopCustomerService } from './PrestaShopCustomerService';
import { ECommercePlatform } from '../../../../../shared/utils/platforms';

const mockSecretsService = require('../../../../../shared/services/secrets/SecretsService');
const mockGetSecret = mockSecretsService.__mockGetSecret;

describe('PrestaShopCustomerService', () => {
  let service: PrestaShopCustomerService;
  const mockBaseUrl = 'https://prestashop.example.com';
  const mockApiClient = {
    isInitialized: jest.fn(),
    configure: jest.fn(),
    initialize: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PrestaShopCustomerService();
    (service as unknown as { apiClient: typeof mockApiClient }).apiClient = mockApiClient;

    mockGetSecret.mockImplementation((key: string) => {
      if (key === 'PRESTASHOP_BASE_URL') return Promise.resolve(mockBaseUrl);
      return Promise.resolve(null);
    });

    mockApiClient.isInitialized.mockReturnValue(true);
    mockApiClient.initialize.mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    it('should initialize successfully with valid config', async () => {
      const result = await service.initialize();
      expect(result).toBe(true);
      expect(service.isInitialized()).toBe(true);
    });

    it('should fail initialization without base URL', async () => {
      mockGetSecret.mockResolvedValue(null);
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
      mockApiClient.get.mockResolvedValue(mockResponse);

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
});
