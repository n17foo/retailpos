/**
 * PAY-03 regression tests — in production the Stripe backend proxy is
 * mandatory; the client must not silently fall back to the direct Stripe
 * API (which would require the secret key on the register).
 */

import { StripeApiClient } from './StripeApiClient';

describe('StripeApiClient (PAY-03)', () => {
  const originalDev = (globalThis as Record<string, unknown>).__DEV__;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = originalDev;
  });

  it('throws in production when no backendUrl is configured', async () => {
    (globalThis as Record<string, unknown>).__DEV__ = false;
    const client = StripeApiClient.getInstance();
    client.configure({ storeUrl: 'https://api.stripe.com', apiKey: 'sk_test_x' });

    await expect(client.postToBackend('stripe/refund', 'v1/refunds', { payment_intent: 'pi_1' })).rejects.toThrow(
      'Stripe backend URL is not configured'
    );
    await expect(client.getFromBackend('stripe/payment_intent/pi_1', 'v1/payment_intents/pi_1')).rejects.toThrow(
      'Stripe backend URL is not configured'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to the configured backend without the api key in the body', async () => {
    (globalThis as Record<string, unknown>).__DEV__ = false;
    const client = StripeApiClient.getInstance();
    client.configure({ backendUrl: 'https://merchant.example', apiKey: 'sk_test_x' });
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '20' }),
      json: async () => ({ success: true }),
    });

    await client.postToBackend('stripe/refund', 'v1/refunds', { payment_intent: 'pi_1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://merchant.example/stripe/refund');
    expect(init.body).not.toContain('sk_test_x');
  });
});
