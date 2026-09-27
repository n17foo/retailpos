// Mock the shared API client before imports
const mockApiClient = {
  configure: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../clients/commercefull/CommercefullApiClient', () => ({
  CommercefullApiClient: {
    getInstance: jest.fn(() => mockApiClient),
  },
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

jest.mock('../../secrets/SecretsService', () => ({
  secretsServiceFactory: { getService: jest.fn(() => ({ getSecret: jest.fn() })) },
}));

import { CommercefullCustomerService } from './CommercefullCustomerService';

const envelope = (data: unknown) => ({ success: true, data });

describe('CommercefullCustomerService', () => {
  let service: CommercefullCustomerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CommercefullCustomerService({ storeUrl: 'https://api.example.com', apiKey: 'k', apiSecret: 's' });
    await service.initialize();
  });

  it('should unwrap the nested PaginatedResult envelope and send offset pagination', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        data: [
          { customerId: 'c1', email: 'a@b.com', firstName: 'Ann', lastName: 'Lee', phone: '555', tags: ['vip'], preferredCurrency: 'USD' },
        ],
        total: 30,
        limit: 20,
        offset: 0,
        hasMore: true,
      })
    );

    const result = await service.searchCustomers({ query: 'ann', limit: 20 });

    expect(mockApiClient.get).toHaveBeenCalledWith('/business/customers', { limit: '20', offset: '0', search: 'ann' });
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0]).toMatchObject({ id: 'c1', email: 'a@b.com', firstName: 'Ann', currency: 'USD' });
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('20');
  });

  it('should implement getCustomer via GET /business/customers/:id', async () => {
    mockApiClient.get.mockResolvedValueOnce(envelope({ customerId: 'c9', email: 'x@y.com', firstName: 'X', lastName: 'Y' }));

    const customer = await service.getCustomer('c9');

    expect(mockApiClient.get).toHaveBeenCalledWith('/business/customers/c9');
    expect(customer).toMatchObject({ id: 'c9', email: 'x@y.com' });
  });

  it('should return null when the customer is not found', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('404'));
    expect(await service.getCustomer('missing')).toBeNull();
  });
});
