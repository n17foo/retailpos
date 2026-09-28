/**
 * Metadata redaction for log transports.
 *
 * Keys are split on separators and camelCase boundaries, then each word is
 * compared against a sensitive-word list — so `apiKey`, `shared_secret`,
 * `x-auth-token` and `userPin` all redact, while `shippingAddress` or
 * `monkey` do not (substring matching would over-redact `pin` inside
 * "shipping").
 *
 * Redaction happens before entries reach external transports (Sentry,
 * Datadog, …); it intentionally does not alter objects seen by the local
 * console, which is only enabled in `__DEV__`.
 */

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;
const MAX_ARRAY_LENGTH = 100;

const SENSITIVE_WORDS = new Set([
  'secret',
  'token',
  'password',
  'passwd',
  'pwd',
  'pin',
  'pincode',
  'apikey',
  'authorization',
  'credential',
  'credentials',
  'signature',
  'session',
  'cookie',
  'key',
  'auth',
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  if (SENSITIVE_WORDS.has(normalized)) return true;
  return normalized.split(/[^a-z0-9]+|\s+/).some(word => SENSITIVE_WORDS.has(word));
}

/**
 * Deep-copy a metadata value with sensitive keys replaced by '[REDACTED]'.
 * Non-plain values (Errors, Dates, functions) are passed through unchanged —
 * transports already know how to serialize them.
 */
export function redactLogMetadata(value: unknown, depth: number = 0): unknown {
  if (value === null || value === undefined || depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map(item => redactLogMetadata(item, depth + 1));
  }
  if (typeof value === 'object') {
    // Only walk plain objects; leave class instances (Error, Date, …) alone.
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redactLogMetadata(entry, depth + 1);
    }
    return out;
  }
  return value;
}
