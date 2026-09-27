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

import { CommercefullRefundService } from './CommercefullRefundService';

const envelope = (data: unknown) => ({ success: true, data });

describe('CommercefullRefundService', () => {
  let service: CommercefullRefundService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CommercefullRefundService({ storeUrl: 'https://api.example.com', apiKey: 'k', apiSecret: 's' });
    await service.initialize();
  });

  it('should send the refund amount in integer cents with a reason', async () => {
    mockApiClient.post.mockResolvedValueOnce(
      envelope({
        orderId: 'o1',
        refundAmountCents: 1250,
        isFullRefund: false,
        newPaymentStatus: 'partiallyRefunded',
        processedAt: '2024-01-01T00:00:00Z',
      })
    );

    const result = await service.processRefund('o1', { amount: 12.5, reason: 'damaged item' });

    expect(mockApiClient.post).toHaveBeenCalledWith('/business/orders/o1/refund', { amount: 1250, reason: 'damaged item' });
    expect(result.success).toBe(true);
    expect(result.amount).toBe(12.5);
  });

  it('should supply a default reason when none is provided', async () => {
    mockApiClient.post.mockResolvedValueOnce(envelope({ refundAmountCents: 500 }));

    await service.processRefund('o1', { amount: 5 });

    const [, body] = mockApiClient.post.mock.calls[0];
    expect(body.reason).toBeTruthy();
  });

  it('should read refund history from the dedicated refunds endpoint', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        orderId: 'o1',
        refunds: [{ refundId: 'r1', amountCents: 1250, reason: 'damaged', status: 'completed', createdAt: '2024-01-01T00:00:00Z' }],
      })
    );

    const refunds = await service.getRefundHistory('o1');

    expect(mockApiClient.get).toHaveBeenCalledWith('/business/orders/o1/refunds');
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ id: 'r1', orderId: 'o1', amount: 12.5, reason: 'damaged', status: 'completed' });
  });
});
