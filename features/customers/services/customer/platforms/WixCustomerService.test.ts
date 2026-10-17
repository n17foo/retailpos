// Mock the dependencies before importing anything
jest.mock('../../../../../shared/services/secrets/SecretsService', () => {
  const mockGetSecret = jest.fn();
  return {
    secretsServiceFactory: {
      getService: jest.fn(() => ({
        getSecret: mockGetSecret,
      })),
    },
    // Export the mock so we can access it in tests
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
import { WixCustomerService } from './WixCustomerService';
import { ECommercePlatform } from '../../../../../shared/utils/platforms';

// Get the mock function
const mockSecretsService = require('../../../../../shared/services/secrets/SecretsService');
const mockGetSecret = mockSecretsService.__mockGetSecret;

describe('WixCustomerService', () => {
  let service: WixCustomerService;
  const mockSiteId = 'test-site-id';
  const mockApiClient = {
    isInitialized: jest.fn(),
    configure: jest.fn(),
    initialize: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WixCustomerService();
    (service as unknown as { apiClient: typeof mockApiClient }).apiClient = mockApiClient;

    mockGetSecret.mockImplementation((key: string) => {
      if (key === 'WIX_SITE_ID') return Promise.resolve(mockSiteId);
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

    it('should fail initialization without site ID', async () => {
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
        contacts: [
          {
            id: 'contact-1',
            info: {
              name: { first: 'John', last: 'Doe' },
            },
            primaryInfo: {
              email: 'john@example.com',
            },
            createdDate: '2024-01-01T00:00:00Z',
          },
        ],
        pagingMetadata: { total: 1 },
      };
      mockApiClient.post.mockResolvedValue(mockResponse);

      const result = await service.searchCustomers({ query: 'john', limit: 10 });

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0]).toEqual({
        id: 'contact-1',
        platformId: 'contact-1',
        platform: ECommercePlatform.WIX,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: undefined,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: undefined,
      });
      expect(result.hasMore).toBe(false);
    });
  });
});
