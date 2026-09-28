import { redactLogMetadata } from './redaction';

describe('redactLogMetadata', () => {
  it('redacts sensitive keys across naming styles', () => {
    const result = redactLogMetadata({
      apiKey: 'abc123',
      shared_secret: 'shh',
      'x-auth-token': 'tok',
      userPin: '123456',
      password: 'hunter2',
      Authorization: 'Bearer x',
      sessionId: 's1',
      privateKey: 'pk',
    }) as Record<string, unknown>;

    for (const value of Object.values(result)) {
      expect(value).toBe('[REDACTED]');
    }
  });

  it('does not over-redact unrelated keys', () => {
    const result = redactLogMetadata({
      shippingAddress: '1 Main St',
      spinner: true,
      monkey: 'ok',
      orderId: 'o1',
      paymentMethod: 'card',
    }) as Record<string, unknown>;

    expect(result.shippingAddress).toBe('1 Main St');
    expect(result.spinner).toBe(true);
    expect(result.monkey).toBe('ok');
    expect(result.orderId).toBe('o1');
    // 'payment' contains no sensitive word; 'method' is not sensitive
    expect(result.paymentMethod).toBe('card');
  });

  it('redacts nested objects and arrays', () => {
    const result = redactLogMetadata({
      config: { nested: { accessToken: 'tok', url: 'https://x' } },
      list: [{ apiKey: 'k1' }, { name: 'safe' }],
    }) as Record<string, unknown>;

    expect((result.config as { nested: { accessToken: string; url: string } }).nested.accessToken).toBe('[REDACTED]');
    expect((result.config as { nested: { url: string } }).nested.url).toBe('https://x');
    expect((result.list as { apiKey?: string; name?: string }[])[0].apiKey).toBe('[REDACTED]');
    expect((result.list as { name?: string }[])[1].name).toBe('safe');
  });

  it('leaves primitives, errors, and class instances untouched', () => {
    const err = new Error('boom');
    expect(redactLogMetadata('plain')).toBe('plain');
    expect(redactLogMetadata(42)).toBe(42);
    expect(redactLogMetadata(null)).toBeNull();
    expect(redactLogMetadata(err)).toBe(err);
    expect(redactLogMetadata(new Date(0))).toBeInstanceOf(Date);
  });

  it('caps recursion depth and array length', () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 10; i++) {
      cur.next = { apiKey: 'deep', next: undefined };
      cur = cur.next as Record<string, unknown>;
    }
    expect(() => redactLogMetadata(deep)).not.toThrow();

    const big = { items: Array.from({ length: 150 }, (_, i) => i) };
    const result = redactLogMetadata(big) as { items: unknown[] };
    expect(result.items.length).toBe(100);
  });
});
