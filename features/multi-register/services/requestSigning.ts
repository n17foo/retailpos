import { hmacSha256Hex, randomHex, sha256Hex } from '../../../shared/utils/crypto';

/**
 * HMAC request signing for the LAN API — client side.
 *
 * Clients authenticate every request with a signature instead of transmitting
 * the shared secret itself:
 *
 *   x-instore-register   register identifier (audit/attribution only)
 *   x-instore-timestamp  client clock in ms — must be within ±SIGNATURE_WINDOW_MS
 *   x-instore-nonce      unique random value — replays within the window are rejected
 *   x-instore-signature  HMAC-SHA256 hex of the canonical payload:
 *
 *     METHOD \n PATH?QUERY \n TIMESTAMP \n NONCE \n sha256hex(rawBody || '')
 *
 * The secret never leaves the device. Signing proves knowledge of the secret
 * and binds the request method, path, body and freshness — it does NOT encrypt
 * the payload, so a trusted/encrypted LAN remains a deployment requirement.
 *
 * Signature verification happens on the in-store server, which is a separate
 * project (ADR-018) — this module only produces signatures.
 */

export const SIGNATURE_HEADERS = {
  register: 'x-instore-register',
  timestamp: 'x-instore-timestamp',
  nonce: 'x-instore-nonce',
  signature: 'x-instore-signature',
} as const;

export const SIGNATURE_WINDOW_MS = 5 * 60_000;

export interface SignedRequestHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
}

/**
 * Produce signature headers for an outgoing request.
 * `pathWithQuery` must be exactly what the server sees, e.g. `/api/orders?status=paid`.
 */
export function signRequest(secret: string, method: string, pathWithQuery: string, rawBody: string): SignedRequestHeaders {
  const timestamp = String(Date.now());
  const nonce = randomHex(16);
  const canonicalPayload = [method.toUpperCase(), pathWithQuery, timestamp, nonce, sha256Hex(rawBody)].join('\n');
  const signature = hmacSha256Hex(secret, canonicalPayload);
  return { timestamp, nonce, signature };
}
