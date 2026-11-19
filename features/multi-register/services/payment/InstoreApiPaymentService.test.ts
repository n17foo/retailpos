/**
 * CHK-01 regression tests — a PED payment that never reached a terminal
 * state is NOT a confirmed decline. The outcome must be modelled as
 * 'unknown' with the payment-intent id preserved, so the caller keeps the
 * order in 'processing' instead of making it retryable (double-charge risk).
 */
import type { PaymentIntent } from './PaymentIntentTypes';

jest.mock('./PaymentIntentClient', () => ({
  paymentIntentClient: {
    initiatePayment: jest.fn(),
    getIntentsForOrder: jest.fn(),
    pollUntilTerminal: jest.fn(),
    recoverOutcome: jest.fn(),
  },
}));

jest.mock('../websocket/StoreApiWebSocket', () => ({
  storeApiWebSocket: { state: 'idle', on: jest.fn(), off: jest.fn() },
}));

import { paymentIntentClient } from './PaymentIntentClient';
import { InstoreApiPaymentService } from './InstoreApiPaymentService';

const intent = (over: Partial<PaymentIntent>): PaymentIntent =>
  ({
    payment_intent_id: 'pi-1',
    order_id: 'ord-1',
    attempt_no: 1,
    idempotency_key: 'k',
    merchant_transaction_reference: 'mtr',
    provider: 'worldpay',
    state: 'created',
    currency: 'GBP',
    amount_minor: 500,
    tip_minor: 0,
    surcharge_minor: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  }) as PaymentIntent;

const CONFIG = { provider: 'worldpay', terminalId: 't1', pedDeviceId: 'd1', currency: 'GBP' };

function connectedService(): InstoreApiPaymentService {
  const service = new InstoreApiPaymentService(CONFIG);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (service as any).connected = true;
  return service;
}

const REQUEST = { amount: 5, reference: 'ORDER-ord-1', currency: 'GBP', orderId: 'ord-1' };

describe('InstoreApiPaymentService — CHK-01 outcome modeling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists the intent id via onPaymentAttempt as soon as it exists', async () => {
    (paymentIntentClient.initiatePayment as jest.Mock).mockResolvedValue({ payment_intent: intent({}) });
    (paymentIntentClient.pollUntilTerminal as jest.Mock).mockResolvedValue(intent({ state: 'approved' }));

    const attempts: string[] = [];
    const res = await connectedService().processPayment({ ...REQUEST, onPaymentAttempt: id => attempts.push(id) });

    expect(attempts).toEqual(['pi-1']);
    expect(res.success).toBe(true);
    expect(res.outcome).toBe('approved');
  });

  it('a non-terminal intent after the wait maps to outcome unknown, not decline', async () => {
    (paymentIntentClient.initiatePayment as jest.Mock).mockResolvedValue({ payment_intent_id: undefined, payment_intent: intent({}) });
    // Polling times out — the intent is still waiting for the cardholder
    (paymentIntentClient.pollUntilTerminal as jest.Mock).mockResolvedValue(intent({ state: 'waiting_for_cardholder' }));

    const res = await connectedService().processPayment(REQUEST);

    expect(res.success).toBe(false);
    expect(res.outcome).toBe('unknown');
    expect(res.transactionId).toBe('pi-1');
  });

  it('a transport failure after intent creation keeps the intent id and reports unknown', async () => {
    (paymentIntentClient.initiatePayment as jest.Mock).mockResolvedValue({ payment_intent: intent({}) });
    (paymentIntentClient.pollUntilTerminal as jest.Mock).mockRejectedValue(new Error('connection reset'));

    const res = await connectedService().processPayment(REQUEST);

    expect(res.success).toBe(false);
    expect(res.outcome).toBe('unknown');
    expect(res.transactionId).toBe('pi-1');
  });

  it('a confirmed decline maps to outcome declined', async () => {
    (paymentIntentClient.initiatePayment as jest.Mock).mockResolvedValue({ payment_intent: intent({}) });
    (paymentIntentClient.pollUntilTerminal as jest.Mock).mockResolvedValue(intent({ state: 'declined', result_message: 'Card declined' }));

    const res = await connectedService().processPayment(REQUEST);

    expect(res.success).toBe(false);
    expect(res.outcome).toBe('declined');
  });

  describe('getOpenPaymentForOrder', () => {
    it('returns the approved intent when one exists for the order', async () => {
      (paymentIntentClient.getIntentsForOrder as jest.Mock).mockResolvedValue([
        intent({ payment_intent_id: 'pi-a', state: 'declined' }),
        intent({ payment_intent_id: 'pi-b', state: 'approved' }),
      ]);

      const res = await connectedService().getOpenPaymentForOrder('ord-1');

      expect(res?.transactionId).toBe('pi-b');
      expect(res?.outcome).toBe('approved');
    });

    it('returns the in-flight intent when nothing is approved but a charge may still exist', async () => {
      (paymentIntentClient.getIntentsForOrder as jest.Mock).mockResolvedValue([
        intent({ payment_intent_id: 'pi-a', state: 'declined' }),
        intent({ payment_intent_id: 'pi-c', state: 'unknown_requires_recovery' }),
      ]);

      const res = await connectedService().getOpenPaymentForOrder('ord-1');

      expect(res?.transactionId).toBe('pi-c');
      expect(res?.outcome).toBe('unknown');
    });

    it('returns null only when every intent ended without a charge', async () => {
      (paymentIntentClient.getIntentsForOrder as jest.Mock).mockResolvedValue([
        intent({ state: 'declined' }),
        intent({ state: 'cancelled' }),
        intent({ state: 'failed' }),
      ]);

      expect(await connectedService().getOpenPaymentForOrder('ord-1')).toBeNull();
    });

    it('returns null when the order has no intents at all', async () => {
      (paymentIntentClient.getIntentsForOrder as jest.Mock).mockResolvedValue([]);

      expect(await connectedService().getOpenPaymentForOrder('ord-1')).toBeNull();
    });
  });
});
