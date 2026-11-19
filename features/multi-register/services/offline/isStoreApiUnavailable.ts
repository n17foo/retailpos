import { ApiError, RequestTimeoutError } from '../../../../shared/utils/apiErrors';

/**
 * Distinguishes "the store API server is unreachable or broken" (safe to
 * degrade — queue writes, serve caches) from real application errors
 * (4xx — server answered coherently; must propagate, not fall back).
 *
 * Degrade on:
 * - fetch TypeError (RN "Network request failed", undici "fetch failed")
 * - abort/timeout (AbortError, RequestTimeoutError)
 * - typed ApiError with status ≥ 500 — the server is alive but wedged;
 *   queued replays are idempotent so a false positive is safe
 *
 * Propagate on:
 * - ApiError with status < 500 (404, 409, 422 — real rejections)
 * - any other application error
 */
export function isStoreApiUnavailable(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  if (error instanceof RequestTimeoutError) return true;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (/network request failed|failed to fetch|econnrefused|enotfound|ehostunreach|timed? ?out|socket hang up/i.test(error.message)) {
      return true;
    }
    // Fallback for untyped stragglers — "GET /x failed: 503" style.
    return /(?:failed|status)[:\s]+5\d\d\b/.test(error.message);
  }
  return false;
}
