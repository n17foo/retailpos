import { AuthAttemptLimiter } from './AuthAttemptLimiter';

describe('AuthAttemptLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not let a successful attempt erase the failure budget', () => {
    const limiter = new AuthAttemptLimiter(3, 1_000, 10_000);

    limiter.recordResult(false);
    limiter.recordResult(false);
    limiter.recordResult(true);
    limiter.recordResult(false);

    expect(limiter.getLockoutRemainingMs()).toBe(1_000);
  });

  it('forgets old failures after the inactivity window', () => {
    const limiter = new AuthAttemptLimiter(3, 1_000, 10_000);

    limiter.recordResult(false);
    limiter.recordResult(false);
    jest.advanceTimersByTime(10_001);
    limiter.recordResult(false);

    expect(limiter.getLockoutRemainingMs()).toBe(0);
  });
});
