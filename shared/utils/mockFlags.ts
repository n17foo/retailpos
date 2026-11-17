/**
 * Mock-service flags are dev-only. A production build must never silently use
 * a mock payment terminal, printer, scanner, or secrets backend — even if a
 * stale .env carried `USE_MOCK_*=true` into the release pipeline.
 *
 * `__DEV__` is defined by the RN/Metro bundler (false in release builds). In
 * environments where it isn't defined (Electron main), NODE_ENV is the
 * fallback signal; unknown → treat as production and disable.
 */
export function isMockFlagEnabled(flag: string | undefined): boolean {
  if (flag !== 'true') return false;
  if (typeof __DEV__ === 'boolean') return __DEV__;
  return process.env.NODE_ENV !== 'production';
}
