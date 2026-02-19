import { WixCustomerService } from './WixCustomerService';

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

import secretsService from '../../secrets/secretsService';
import { getPlatformToken } from '../../token/tokenUtils';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { ECommercePlatform } from '../../../utils/platforms';

describe('WixCustomerService', () => {
  let service: WixCustomerService;
  const mockSiteId = 'test-site-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WixCustomerService();

    (secretsService.getSecret as jest.Mock).mockImplementation((key: string) => {
      if (key === 'WIX_SITE_ID') return Promise.resolve(mockSiteId);
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

    it('should fail initialization without site ID', async () => {
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

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

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

  describe('getCustomer', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should fetch customer successfully', async () => {
      const mockContact = {
        id: 'contact-1',
        info: {
          name: { first: 'Jane', last: 'Smith' },
        },
        primaryInfo: {
          email: 'jane@example.com',
          phone: '+1234567890',
        },
        createdDate: '2024-01-01T00:00:00Z',
        updatedDate: '2024-01-02T00:00:00Z',
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contact: mockContact }),
      } as any);

      const result = await service.getCustomer('contact-1');

      expect(result).toEqual({
        id: 'contact-1',
        platformId: 'contact-1',
        platform: ECommercePlatform.WIX,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+1234567890',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      });
    });
  });
});
