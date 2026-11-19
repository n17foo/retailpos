/**
 * PAY-04 regression — with an AdyenTerminal surface present, amounts must be
 * sent to the SDK in minor units (PaymentRequest.amount is major units).
 */
const startPayment = jest.fn();
const refundPayment = jest.fn();
const connect = jest.fn();

jest.mock('@adyen/react-native', () => ({
  AdyenTerminal: {
    connect: (...args: unknown[]) => connect(...args),
    disconnect: jest.fn(),
    discoverTerminals: jest.fn(async () => []),
    startPayment: (...args: unknown[]) => startPayment(...args),
    cancelPayment: jest.fn(),
    refundPayment: (...args: unknown[]) => refundPayment(...args),
  },
}));

jest.mock('../../platform-clients/services/config/StoreCurrency', () => ({
  getStoreCurrencyCode: jest.fn(async () => 'eur'),
}));

import { AdyenService } from './AdyenService';

describe('PAY-04 — Adyen minor units', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connect.mockResolvedValue(undefined);
  });

  it('sends amount.value in minor units for payments', async () => {
    startPayment.mockResolvedValue({
      resultCode: 'Authorised',
      pspReference: 'psp-1',
    });

    const service = AdyenService.getInstance();
    await service.connectToTerminal('terminal-1');
    const response = await service.processPayment({
      amount: 25.5,
      currency: 'eur',
      reference: 'ref-1',
      orderId: 'order-1',
    });

    expect(startPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: { value: 2550, currency: 'EUR' } }));
    expect(response.success).toBe(true);
  });

  it('sends amount.value in minor units for refunds', async () => {
    refundPayment.mockResolvedValue({ status: 'received', pspReference: 'refund-1' });

    const service = AdyenService.getInstance();
    await service.connectToTerminal('terminal-1');
    const response = await service.refundTransaction('psp-1', 12.34);

    expect(refundPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: { value: 1234, currency: 'EUR' } }));
    expect(response.success).toBe(true);
  });
});
