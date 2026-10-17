import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { usePayment } from './usePayment';
import paymentService from '../services/PaymentService';
import { PaymentProvider } from '../services/PaymentServiceFactory';
import { isElectron, isMobile } from '../../../shared/utils/electron';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null },
}));

jest.mock('../services/PaymentService', () => ({
  __esModule: true,
  default: {
    connectToTerminal: jest.fn(),
    processPayment: jest.fn(),
    disconnect: jest.fn(),
    isTerminalConnected: jest.fn(),
    getConnectedDeviceId: jest.fn(),
    getAvailableTerminals: jest.fn(),
    setPaymentProvider: jest.fn(),
    getCurrentProvider: jest.fn(),
  },
}));

jest.mock('../../../shared/utils/electron', () => ({
  isElectron: jest.fn(),
  isMobile: jest.fn(),
}));

function mountHook() {
  let latest: ReturnType<typeof usePayment> | null = null;
  function Harness() {
    latest = usePayment();
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('usePayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns cash_only mode on Electron', () => {
    (isElectron as jest.Mock).mockReturnValue(true);
    (isMobile as jest.Mock).mockReturnValue(false);
    (paymentService.getCurrentProvider as jest.Mock).mockReturnValue(PaymentProvider.STRIPE_NFC);

    const { get } = mountHook();
    expect(get().getPaymentMode()).toBe('cash_only');
  });

  it('returns tap_to_pay on mobile with a tap-to-pay provider', () => {
    (isElectron as jest.Mock).mockReturnValue(false);
    (isMobile as jest.Mock).mockReturnValue(true);
    (paymentService.getCurrentProvider as jest.Mock).mockReturnValue(PaymentProvider.STRIPE_NFC);

    const { get } = mountHook();
    expect(get().getPaymentMode()).toBe('tap_to_pay');
  });

  it('delegates processPayment and connectToTerminal to paymentService', async () => {
    (paymentService.connectToTerminal as jest.Mock).mockResolvedValue(true);
    (paymentService.processPayment as jest.Mock).mockResolvedValue({ success: true, transactionId: 'tx-1' });

    const { get } = mountHook();

    expect(await get().connectToTerminal('dev-1')).toBe(true);
    expect(await get().processPayment({ amount: 10, currency: 'GBP', reference: 'r1' })).toEqual({
      success: true,
      transactionId: 'tx-1',
    });
  });
});
