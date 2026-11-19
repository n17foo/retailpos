import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { toCents } from '../../../shared/utils/money';

/**
 * Backend endpoints for Stripe Terminal operations (PAY-03).
 *
 * The Stripe secret key must never leave the merchant's own backend. Every
 * call here requires a configured backend URL — there is no placeholder
 * fallback host — and request bodies never carry the secret key. The backend
 * holds the key and is responsible for authenticating the register.
 */

const BACKEND_URL_KEY = 'stripe_nfc_backendUrl';

async function requireBackendUrl(): Promise<string> {
  const backendUrl = (await keyValueRepository.getItem(BACKEND_URL_KEY))?.replace(/\/+$/, '');
  if (!backendUrl) {
    throw new Error('Stripe backend URL is not configured');
  }
  return backendUrl;
}

export async function fetchStripeConnectionToken(locationId: string): Promise<string> {
  const base = await requireBackendUrl();
  const response = await fetch(`${base}/stripe/connection_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token fetch failed: ${response.status} - ${errorText}`);
  }
  const { secret } = (await response.json()) as { secret?: string };
  if (!secret) {
    throw new Error('Stripe backend returned no connection token');
  }
  return secret;
}

export interface StripePaymentIntentRequest {
  /** Amount in major currency units (e.g. pounds); converted to minor units here. */
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export async function createStripePaymentIntent(request: StripePaymentIntentRequest): Promise<{ id: string } & Record<string, unknown>> {
  const base = await requireBackendUrl();
  const response = await fetch(`${base}/stripe/create_payment_intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: toCents(request.amount),
      currency: request.currency,
      description: request.description,
      metadata: request.metadata ?? {},
    }),
  });
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }
  const intent = (await response.json()) as { id?: string } & Record<string, unknown>;
  if (!intent.id) {
    throw new Error('Backend returned no payment intent');
  }
  return intent as { id: string } & Record<string, unknown>;
}

export async function cancelStripePayment(paymentIntentId: string): Promise<boolean> {
  const base = await requireBackendUrl();
  const response = await fetch(`${base}/stripe/cancel_payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId }),
  });
  const result = (await response.json()) as { success?: boolean; error?: string };
  if (!result.success) {
    throw new Error(result.error || 'Cancel payment failed');
  }
  return true;
}

export async function createStripeRefund(paymentIntentId: string, amount: number): Promise<boolean> {
  const base = await requireBackendUrl();
  const response = await fetch(`${base}/stripe/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentIntentId, amount: toCents(amount) }),
  });
  const result = (await response.json()) as { success?: boolean; error?: string };
  if (!result.success) {
    throw new Error(result.error || 'Refund failed');
  }
  return true;
}
