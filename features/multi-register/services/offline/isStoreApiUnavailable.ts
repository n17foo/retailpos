/**
 * Distinguishes "the store API server is unreachable" (LAN outage — safe to
 * degrade) from real HTTP/application errors (server answered — must
 * propagate, not fall back).
 *
 * fetch throws TypeError on React Native for DNS/connect failures and an
 * AbortError on timeout; our client's own `new Error("GET /x failed: 404")`
 * style errors do NOT match — they mean the server responded.
 */
export function isStoreApiUnavailable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    return /network request failed|failed to fetch|econnrefused|enotfound|ehostunreach|timed? ?out|socket hang up/i.test(error.message);
  }
  return false;
}
