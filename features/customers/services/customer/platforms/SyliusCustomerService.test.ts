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
import { SyliusCustomerService } from './SyliusCustomerService';
import { ECommercePlatform } from '../../../../../shared/utils/platforms';

const mockSecretsService = require('../../../../../shared/services/secrets/SecretsService');
const mockGetSecret = mockSecretsService.__mockGetSecret;

describe('SyliusCustomerService', () => {
  let service: SyliusCustomerService;
  const mockBaseUrl = 'https://sylius.example.com';
  const mockApiClient = {
    isInitialized: jest.fn(),
    configure: jest.fn(),
    initialize: jest.fn(),
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyliusCustomerService();
    (service as unknown as { apiClient: typeof mockApiClient }).apiClient = mockApiClient;

    mockGetSecret.mockImplementation((key: string) => {
      if (key === 'SYLIUS_BASE_URL') return Promise.resolve(mockBaseUrl);
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
      mockApiClient.get.mockResolvedValue(mockResponse);

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
});
