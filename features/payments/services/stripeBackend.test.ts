/**
 * PAY-03 regression tests — Stripe backend calls must require a configured
 * backend URL (no placeholder host) and must never send the secret key in
 * request bodies.
 */

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: { getItem: jest.fn() },
}));

import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { cancelStripePayment, createStripePaymentIntent, createStripeRefund, fetchStripeConnectionToken } from './stripeBackend';

const getItem = keyValueRepository.getItem as jest.Mock;

describe('stripeBackend (PAY-03)', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('without a backend URL', () => {
    beforeEach(() => getItem.mockResolvedValue(null));

    it('fails closed for connection tokens', async () => {
      await expect(fetchStripeConnectionToken('loc_1')).rejects.toThrow('Stripe backend URL is not configured');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails closed for payment intents', async () => {
      await expect(createStripePaymentIntent({ amount: 10, currency: 'gbp', description: 'x' })).rejects.toThrow(
        'Stripe backend URL is not configured'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails closed for cancels and refunds', async () => {
      await expect(cancelStripePayment('pi_1')).rejects.toThrow('Stripe backend URL is not configured');
      await expect(createStripeRefund('pi_1', 5)).rejects.toThrow('Stripe backend URL is not configured');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('with a backend URL', () => {
    beforeEach(() => getItem.mockResolvedValue('https://merchant-backend.example/'));

    it('requests a connection token without sending the secret key', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ secret: 'pst_secret' }) });

      const token = await fetchStripeConnectionToken('loc_1');

      expect(token).toBe('pst_secret');
      const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      expect(url).toBe('https://merchant-backend.example/stripe/connection_token');
      expect(JSON.parse(init.body)).toEqual({ locationId: 'loc_1' });
    });

    it('cancels a payment without sending the secret key', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      await expect(cancelStripePayment('pi_1')).resolves.toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      expect(url).toBe('https://merchant-backend.example/stripe/cancel_payment');
      expect(JSON.parse(init.body)).toEqual({ paymentIntentId: 'pi_1' });
    });

    it('refunds a payment without sending the secret key, amount in minor units', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

      await expect(createStripeRefund('pi_1', 12.5)).resolves.toBe(true);
      const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
      expect(url).toBe('https://merchant-backend.example/stripe/refund');
      expect(JSON.parse(init.body)).toEqual({ paymentIntentId: 'pi_1', amount: 1250 });
    });
  });
});
