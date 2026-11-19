/**
 * PAY-02 regression tests — collecting a Square card nonce must not be
 * reported as a completed payment. The nonce is charged through the
 * merchant's backend, and success requires a confirmed payment ID.
 */

jest.mock(
  'react-native-square-in-app-payments',
  () => ({
    SQIPCore: { setSquareApplicationId: jest.fn() },
    SQIPCardEntry: { startCardEntryFlow: jest.fn(), completeCardEntry: jest.fn() },
  }),
  { virtual: true }
);

jest.mock('../../platform-clients/services/config/PaymentSettingsStorage', () => ({
  PaymentSettingsStorage: { load: jest.fn() },
}));

import { SquareService } from './SquareService';
import { PaymentSettingsStorage } from '../../platform-clients/services/config/PaymentSettingsStorage';

interface SquareSdkMock {
  SQIPCardEntry: { startCardEntryFlow: jest.Mock; completeCardEntry: jest.Mock };
}

const sdk = jest.requireMock<SquareSdkMock>('react-native-square-in-app-payments');
const loadSettings = PaymentSettingsStorage.load as jest.Mock;

describe('SquareService (PAY-02)', () => {
  let service: SquareService;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    // Reset the singleton so each test gets a fresh service instance.
    (SquareService as unknown as { instance?: SquareService }).instance = undefined;
    service = SquareService.getInstance();

    sdk.SQIPCardEntry.startCardEntryFlow.mockImplementation((_opts: unknown, onSuccess: (details: Record<string, unknown>) => void) =>
      onSuccess({ nonce: 'cnon:test-nonce' })
    );
    sdk.SQIPCardEntry.completeCardEntry.mockImplementation((cb: () => void) => cb());

    await service.connectToTerminal('SQUARE_MOBILE');
  });

  const request = { amount: 12.5, reference: 'ref-1', currency: 'GBP', orderId: 'order-1' };

  it('does not report success when no backend URL is configured', async () => {
    loadSettings.mockResolvedValue(null);

    const result = await service.processPayment(request);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/backend URL/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('charges the nonce through the backend and returns the real payment ID', async () => {
    loadSettings.mockResolvedValue({ square: { backendUrl: 'https://merchant.example/', locationId: 'L1' } });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ paymentId: 'sqpay_real_123' }),
    });

    const result = await service.processPayment(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://merchant.example/square/charge');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      nonce: 'cnon:test-nonce',
      amountCents: 1250,
      currency: 'GBP',
      locationId: 'L1',
      reference: 'ref-1',
      orderId: 'order-1',
      idempotencyKey: 'order-1',
    });

    expect(result.success).toBe(true);
    expect(result.transactionId).toBe('sqpay_real_123');
  });

  it('reports failure when the backend does not confirm a payment', async () => {
    loadSettings.mockResolvedValue({ square: { backendUrl: 'https://merchant.example' } });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await service.processPayment(request);

    expect(result.success).toBe(false);
  });
});
