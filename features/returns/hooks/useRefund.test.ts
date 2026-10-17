import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useRefund } from './useRefund';
import { returnService } from '../services/refunds/RefundService';
import { useManagerApproval } from '../../authentication/hooks/useManagerApproval';
import { ECommercePlatform } from '../../../shared/utils/platforms';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../services/refunds/RefundService', () => ({
  returnService: {
    initializeRefundService: jest.fn(),
    processRefund: jest.fn(),
    processPaymentRefund: jest.fn(),
    processReturn: jest.fn(),
    getRefundHistory: jest.fn(),
    getReturnableItems: jest.fn(),
    getReturnsByOrder: jest.fn(),
  },
}));

jest.mock('../../authentication/hooks/useManagerApproval', () => ({
  useManagerApproval: jest.fn(),
}));

const mockRequestApproval = jest.fn();

async function mountHook() {
  let latest: ReturnType<typeof useRefund> | null = null;
  function Harness() {
    latest = useRefund(ECommercePlatform.SHOPIFY);
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useRefund', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (returnService.initializeRefundService as jest.Mock).mockResolvedValue(true);
    (useManagerApproval as jest.Mock).mockReturnValue({ requestApproval: mockRequestApproval });
  });

  it('initializes returnService on mount', async () => {
    const { get } = await mountHook();
    expect(get().isInitialized).toBe(true);
    expect(get().error).toBeNull();
  });

  it('requires manager approval before processing ecommerce refund', async () => {
    mockRequestApproval.mockResolvedValue(false);
    const { get } = await mountHook();

    let res;
    await act(async () => {
      res = await get().processEcommerceRefund('ord-1', { amount: 10 });
    });

    expect(res).toEqual(expect.objectContaining({ success: false, error: 'Manager approval required to process refunds' }));
    expect(returnService.processRefund).not.toHaveBeenCalled();
  });

  it('processes return and delegates to returnService when approved', async () => {
    mockRequestApproval.mockResolvedValue(true);
    (returnService.processReturn as jest.Mock).mockResolvedValue({
      success: true,
      returnIds: ['ret-1'],
      totalRefund: 15,
    });

    const { get } = await mountHook();

    let res;
    await act(async () => {
      res = await get().processReturn({
        orderId: 'ord-1',
        issueRefund: true,
        items: [{ productId: 'p1', productName: 'Mug', quantity: 1, refundAmount: 15 }],
      });
    });

    expect(mockRequestApproval).toHaveBeenCalledWith('refund:process');
    expect(res).toEqual({ success: true, returnIds: ['ret-1'], totalRefund: 15 });
  });
});
