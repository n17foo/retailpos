import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import RefundScreen from './RefundScreen';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const mockRequestApproval = jest.fn().mockResolvedValue(true);
jest.mock('../../authentication/hooks/useManagerApproval', () => ({
  useManagerApproval: () => ({ requestApproval: mockRequestApproval, isApproving: false }),
}));

const mockProcessPaymentRefund = jest.fn().mockResolvedValue({ success: true });
const mockProcessEcommerceRefund = jest.fn();
const mockProcessReturn = jest.fn();
const mockGetRefundHistory = jest.fn().mockResolvedValue([]);
const mockGetReturnableItems = jest.fn().mockResolvedValue([]);

jest.mock('../hooks/useRefund', () => ({
  useRefund: () => ({
    isInitialized: true,
    isLoading: false,
    error: null,
    processPaymentRefund: mockProcessPaymentRefund,
    processEcommerceRefund: mockProcessEcommerceRefund,
    processReturn: mockProcessReturn,
    getRefundHistory: mockGetRefundHistory,
    getReturnableItems: mockGetReturnableItems,
  }),
}));

describe('RefundScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders refund mode tabs and validates required fields before processing', async () => {
    const tree = await renderUi(<RefundScreen />);
    expect(hasText(tree, 'Returns & Refunds')).toBe(true);
    expect(hasText(tree, 'Payment Refund')).toBe(true);

    await pressByText(tree, 'Process Refund');
    expect(mockRequestApproval).toHaveBeenCalledWith('refund:process');
    expect(hasText(tree, 'Transaction ID and amount are required.')).toBe(true);
  });
});
