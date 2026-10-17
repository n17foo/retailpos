import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PaymentTerminalScreen from './PaymentTerminalScreen';
import { PaymentProvider } from '../services/PaymentServiceFactory';

const mockConnectToTerminal = jest.fn().mockResolvedValue(true);
const mockProcessPayment = jest.fn().mockResolvedValue({
  success: true,
  transactionId: 'tx_987654321',
  cardBrand: 'Visa',
  last4: '4242',
});
const mockDisconnect = jest.fn();
const mockIsTerminalConnected = jest.fn(() => false);
const mockGetAvailableTerminals = jest.fn().mockResolvedValue([{ id: 'term-1', name: 'Reader BBPOS' }]);
const mockGetCurrentProvider = jest.fn(() => PaymentProvider.STRIPE);

jest.mock('../hooks/usePayment', () => ({
  usePayment: () => ({
    connectToTerminal: mockConnectToTerminal,
    processPayment: mockProcessPayment,
    disconnect: mockDisconnect,
    isTerminalConnected: mockIsTerminalConnected,
    getAvailableTerminals: mockGetAvailableTerminals,
    getCurrentProvider: mockGetCurrentProvider,
  }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('PaymentTerminalScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scans for terminals, connects on tap, and charges amount', async () => {
    const navigation = { goBack: jest.fn(), navigate: jest.fn() };
    const route = { params: { amount: 15.5, orderId: 'ord-1' } };

    const tree = await renderUi(<PaymentTerminalScreen navigation={navigation} route={route} />);
    expect(hasText(tree, 'Reader BBPOS')).toBe(true);

    await pressByText(tree, 'Reader BBPOS');
    expect(mockConnectToTerminal).toHaveBeenCalledWith('term-1');

    await pressByText(tree, 'Charge £15.50');
    expect(mockProcessPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 15.5, currency: 'GBP' }));
    expect(hasText(tree, 'Payment Accepted')).toBe(true);
  });
});
