/**
 * Typed transport errors so callers can classify failures without
 * string-matching error messages (which was the root of the dead retry
 * path — `API error 503` never matched a `status (\d+)` regex).
 */

/** An HTTP response with a non-2xx status. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

/** The request timed out client-side — always worth retrying. */
export class RequestTimeoutError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Whether an error is worth retrying for outbound sync work:
 * - transport-level failures (TypeError from fetch, AbortError, timeouts)
 * - 5xx HTTP statuses
 * Everything else (4xx, unknowns) fails permanently.
 */
export function isRetryableTransportError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status >= 500;
  }
  if (error instanceof RequestTimeoutError) {
    return true;
  }
  if (error instanceof TypeError) {
    // fetch() throws TypeError for network-level failures on every engine:
    // RN "Network request failed", web "Failed to fetch", node fetch undici.
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    // Fallback for errors thrown by clients that haven't adopted ApiError
    // yet — match any "… <3-digit status>" shape.
    if (/request timed? ?out/i.test(error.message)) return true;
    const statusMatch = error.message.match(/\b(\d{3})\b/);
    if (statusMatch) return parseInt(statusMatch[1], 10) >= 500;
  }
  return false;
}
