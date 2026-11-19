/**
 * PAY-01 regression tests — a production build must fail closed when a
 * payment provider SDK cannot load; only development builds may fall back
 * to the MockPaymentService.
 */

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null },
}));

jest.mock('./SquareService', () => {
  throw new Error('native module not available');
});

import { PaymentServiceFactory, PaymentProvider } from './PaymentServiceFactory';
import { MockPaymentService } from './mock/MockPaymentService';

describe('PaymentServiceFactory (PAY-01)', () => {
  const originalDev = (globalThis as Record<string, unknown>).__DEV__;

  afterEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = originalDev;
  });

  it('falls back to MockPaymentService in development when the SDK fails to load', () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    const factory = PaymentServiceFactory.getInstance();
    factory.setPaymentProvider(PaymentProvider.SQUARE);

    expect(factory.getPaymentService()).toBe(MockPaymentService.getInstance());
  });

  it('fails closed in production when the SDK fails to load', () => {
    (globalThis as Record<string, unknown>).__DEV__ = false;
    const factory = PaymentServiceFactory.getInstance();
    factory.setPaymentProvider(PaymentProvider.SQUARE);

    expect(() => factory.getPaymentService()).toThrow('Failed to initialize payment service');
  });

  it('fails closed in production for every SDK provider', () => {
    (globalThis as Record<string, unknown>).__DEV__ = false;
    const factory = PaymentServiceFactory.getInstance();
    factory.setPaymentProvider(PaymentProvider.ADYEN);

    expect(() => factory.getPaymentService()).toThrow('Failed to initialize payment service');
  });
});
