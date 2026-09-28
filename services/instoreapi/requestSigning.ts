import { hmacSha256Hex, randomHex, sha256Hex, timingSafeEqual } from '../../utils/crypto';

/**
 * HMAC request signing for the LAN API.
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
 */

export const SIGNATURE_HEADERS = {
  register: 'x-instore-register',
  timestamp: 'x-instore-timestamp',
  nonce: 'x-instore-nonce',
  signature: 'x-instore-signature',
} as const;

export const SIGNATURE_WINDOW_MS = 5 * 60_000;

const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;
const MAX_NONCE_LENGTH = 128;
const MAX_REGISTER_ID_LENGTH = 128;

export interface SignedRequestHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
}

function canonicalPayload(method: string, pathWithQuery: string, timestamp: string, nonce: string, rawBody: string): string {
  return [method.toUpperCase(), pathWithQuery, timestamp, nonce, sha256Hex(rawBody)].join('\n');
}

/**
 * Produce signature headers for an outgoing request.
 * `pathWithQuery` must be exactly what the server sees, e.g. `/api/orders?status=paid`.
 */
export function signRequest(secret: string, method: string, pathWithQuery: string, rawBody: string): SignedRequestHeaders {
  const timestamp = String(Date.now());
  const nonce = randomHex(16);
  const signature = hmacSha256Hex(secret, canonicalPayload(method, pathWithQuery, timestamp, nonce, rawBody));
  return { timestamp, nonce, signature };
}

export type SignatureVerification = { ok: true; registerId: string } | { ok: false; status: number; error: string };

/**
 * Verify the signature headers of an incoming request.
 * `pathWithQuery` and `rawBody` must be the exact values received on the wire.
 * Replay prevention is the caller's job (see the nonce cache in InstoreApiServer).
 */
export function verifyRequestSignature(
  secret: string,
  method: string,
  pathWithQuery: string,
  rawBody: string,
  headers: Record<string, string>
): SignatureVerification {
  const registerId = headers[SIGNATURE_HEADERS.register] ?? '';
  const timestamp = headers[SIGNATURE_HEADERS.timestamp] ?? '';
  const nonce = headers[SIGNATURE_HEADERS.nonce] ?? '';
  const signature = headers[SIGNATURE_HEADERS.signature] ?? '';

  if (!timestamp || !nonce || !signature || registerId.length > MAX_REGISTER_ID_LENGTH) {
    return { ok: false, status: 401, error: 'Missing signature headers' };
  }
  if (!SIGNATURE_PATTERN.test(signature) || nonce.length === 0 || nonce.length > MAX_NONCE_LENGTH) {
    return { ok: false, status: 401, error: 'Malformed signature headers' };
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > SIGNATURE_WINDOW_MS) {
    return { ok: false, status: 401, error: 'Stale or invalid timestamp' };
  }

  const expected = hmacSha256Hex(secret, canonicalPayload(method, pathWithQuery, timestamp, nonce, rawBody));
  if (!timingSafeEqual(signature, expected)) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }

  return { ok: true, registerId };
}
