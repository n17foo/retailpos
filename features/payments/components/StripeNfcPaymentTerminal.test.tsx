import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import StripeNfcPaymentTerminal from './StripeNfcPaymentTerminal';

const mockProcessPayment = jest.fn().mockResolvedValue({
  success: true,
  transactionId: 'tx_nfc_1',
  cardBrand: 'Mastercard',
  timestamp: new Date(),
});

jest.mock('../hooks/usePayment', () => ({
  usePayment: () => ({
    processPayment: mockProcessPayment,
    disconnect: jest.fn(),
    isTerminalConnected: () => true,
  }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

describe('StripeNfcPaymentTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders amount and processes contactless payment', async () => {
    const onPaymentComplete = jest.fn();
    const tree = await renderUi(
      <StripeNfcPaymentTerminal
        amount={24}
        items={[{ id: '1', name: 'Coffee', price: 24, quantity: 1 }]}
        onPaymentComplete={onPaymentComplete}
        onCancel={jest.fn()}
      />
    );
    expect(hasText(tree, 'Contactless Payment')).toBe(true);
    expect(hasText(tree, '£24.00')).toBe(true);

    await pressByText(tree, 'Process Payment');
    expect(mockProcessPayment).toHaveBeenCalled();
    expect(hasText(tree, 'Payment Approved')).toBe(true);
  });
});
