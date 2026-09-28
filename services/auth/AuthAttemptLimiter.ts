/**
 * In-memory brute-force limiter for credential-based auth providers.
 *
 * After `maxAttempts` consecutive failures the limiter locks for an
 * exponentially-growing window (base → max). In-memory only — a restart
 * resets it, which is acceptable for a POS device (and avoids a
 * persistent lockout primitive an attacker could abuse to lock out staff).
 */
export class AuthAttemptLimiter {
  private failedAttempts = 0;
  private lockedUntil = 0;

  constructor(
    private readonly maxAttempts = 5,
    private readonly baseLockoutMs = 30_000,
    private readonly maxLockoutMs = 15 * 60_000
  ) {}

  /** Milliseconds left on the current lockout (0 when not locked). */
  getLockoutRemainingMs(): number {
    return Math.max(0, this.lockedUntil - Date.now());
  }

  recordResult(success: boolean): void {
    if (success) {
      this.failedAttempts = 0;
      this.lockedUntil = 0;
      return;
    }
    this.failedAttempts++;
    if (this.failedAttempts >= this.maxAttempts) {
      const exponent = this.failedAttempts - this.maxAttempts;
      const lockMs = Math.min(this.baseLockoutMs * 2 ** exponent, this.maxLockoutMs);
      this.lockedUntil = Date.now() + lockMs;
    }
  }
}
