/**
 * Cryptographic primitives for environments where Node's `crypto` module and
 * `crypto.subtle` are unavailable (React Native / Hermes).
 *
 * Pure-TS SHA-256 / HMAC-SHA256 (FIPS 180-4), salted PIN hashing, and a
 * constant-time string comparison. Randomness comes from
 * `react-native-get-random-values` (already a dependency — see utils/uuid.ts),
 * which polyfills `crypto.getRandomValues`.
 *
 * These implementations exist to remove ambient-crypto dependencies — they are
 * NOT a replacement for a vetted native crypto stack. If the app gains
 * expo-crypto or a Node crypto polyfill, these can be swapped out.
 */

// Polyfill globalThis.crypto.getRandomValues on React Native. No-op where the
// API already exists (Node ≥19, Electron, modern browsers).
import 'react-native-get-random-values';

// ── UTF-8 encoding ──────────────────────────────────────────────────────────
// Hermes does not guarantee TextEncoder, so encode manually.

function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    // Surrogate pair
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

// ── SHA-256 ─────────────────────────────────────────────────────────────────

const K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
  0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85,
  0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f,
  0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256(bytes: number[]): number[] {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  const bitLen = bytes.length * 8;
  const padded = bytes.slice();
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);
  // 64-bit big-endian length (safe for inputs < 2^53 bits)
  const hi = Math.floor(bitLen / 0x100000000);
  for (let i = 3; i >= 0; i--) padded.push((hi >>> (i * 8)) & 0xff);
  for (let i = 3; i >= 0; i--) padded.push((bitLen >>> (i * 8)) & 0xff);

  const w = new Array<number>(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] =
        ((padded[block + t * 4] << 24) |
          (padded[block + t * 4 + 1] << 16) |
          (padded[block + t * 4 + 2] << 8) |
          padded[block + t * 4 + 3]) >>>
        0;
    }
    for (let t = 16; t < 64; t++) {
      const s0 = (rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return h;
}

function toHex(words: number[]): string {
  return words.map(word => word.toString(16).padStart(8, '0')).join('');
}

/** SHA-256 hex digest of a UTF-8 string. */
export function sha256Hex(message: string): string {
  return toHex(sha256(utf8Bytes(message)));
}

/** HMAC-SHA256 hex digest. Key and message are UTF-8 strings. */
export function hmacSha256Hex(key: string, message: string): string {
  const BLOCK = 64;
  let keyBytes = utf8Bytes(key);
  if (keyBytes.length > BLOCK) {
    const hashed = sha256(keyBytes);
    keyBytes = [];
    for (const word of hashed) {
      keyBytes.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
    }
  }
  const ipad = new Array(BLOCK).fill(0x36);
  const opad = new Array(BLOCK).fill(0x5c);
  for (let i = 0; i < keyBytes.length; i++) {
    ipad[i] ^= keyBytes[i];
    opad[i] ^= keyBytes[i];
  }
  const inner = sha256(ipad.concat(utf8Bytes(message)));
  const innerBytes: number[] = [];
  for (const word of inner) {
    innerBytes.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
  }
  return toHex(sha256(opad.concat(innerBytes)));
}

// ── Comparisons ─────────────────────────────────────────────────────────────

/**
 * Constant-time string comparison. The XOR accumulator runs over the maximum
 * length so the loop count does not depend on where strings differ. (On a JS
 * VM true constant-time behaviour is approximate, but this avoids the obvious
 * early-exit timing signal.)
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

// ── Randomness ──────────────────────────────────────────────────────────────

/** Random lowercase hex string of `byteCount` bytes (2 chars per byte). */
export function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

// ── PIN hashing ─────────────────────────────────────────────────────────────

const PIN_HASH_PREFIX = 'v1';
const PIN_SALT_BYTES = 16;

/**
 * Hash a PIN for storage. Format: `v1$<saltHex>$<sha256(salt + pin)Hex>`.
 * Salted so identical PINs across users don't share a hash and a leaked
 * database row can't be checked against a rainbow table of the 10^6 PIN space.
 */
export function hashPin(pin: string): string {
  const salt = randomHex(PIN_SALT_BYTES);
  return `${PIN_HASH_PREFIX}$${salt}$${sha256Hex(salt + pin)}`;
}

export function isHashedPin(stored: string): boolean {
  return /^v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(stored);
}

/**
 * Verify a candidate PIN against a stored value.
 * Legacy rows store the raw PIN — those are compared directly (constant-time)
 * so callers can transparently re-hash on successful verify.
 */
export function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return false;
  if (!isHashedPin(stored)) {
    return stored.startsWith(`${PIN_HASH_PREFIX}$`) ? false : timingSafeEqual(pin, stored);
  }
  const [, salt, expected] = stored.split('$');
  if (!salt || !expected) return false;
  return timingSafeEqual(sha256Hex(salt + pin), expected);
}

// The same salted-hash format protects other credential types (passwords,
// magstripe employee IDs, RFID badge IDs) — generic aliases for call sites.
export const hashCredential = hashPin;
export const verifyCredential = verifyPin;
export const isHashedCredential = isHashedPin;
