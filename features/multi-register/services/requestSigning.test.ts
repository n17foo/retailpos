import { signRequest, SIGNATURE_HEADERS } from './requestSigning';
import { hmacSha256Hex, sha256Hex } from '../../../shared/utils/crypto';

const SECRET = 'instore-test-secret';

function expectedSignature(secret: string, method: string, pathWithQuery: string, timestamp: string, nonce: string, rawBody: string) {
  const payload = [method.toUpperCase(), pathWithQuery, timestamp, nonce, sha256Hex(rawBody)].join('\n');
  return hmacSha256Hex(secret, payload);
}

describe('requestSigning (client side)', () => {
  it('produces a signature over method, path+query, timestamp, nonce and body', () => {
    const signed = signRequest(SECRET, 'GET', '/api/orders?status=paid', '');
    expect(signed.signature).toBe(expectedSignature(SECRET, 'GET', '/api/orders?status=paid', signed.timestamp, signed.nonce, ''));
    expect(signed.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('covers the request body', () => {
    const a = signRequest(SECRET, 'POST', '/api/orders', '{"a":1}');
    const b = signRequest(SECRET, 'POST', '/api/orders', '{"a":2}');
    expect(a.signature).not.toBe(b.signature);
  });

  it('covers the path, query and method', () => {
    const base = signRequest(SECRET, 'GET', '/api/orders/abc', '');
    const otherPath = signRequest(SECRET, 'GET', '/api/orders/xyz', '');
    const otherMethod = signRequest(SECRET, 'POST', '/api/orders/abc', '');
    expect(base.signature).not.toBe(otherPath.signature);
    expect(base.signature).not.toBe(otherMethod.signature);
  });

  it('produces unique nonces and fresh timestamps', () => {
    const a = signRequest(SECRET, 'GET', '/api/users', '');
    const b = signRequest(SECRET, 'GET', '/api/users', '');
    expect(a.nonce).not.toBe(b.nonce);
    expect(Math.abs(Date.now() - Number(a.timestamp))).toBeLessThan(5000);
  });

  it('exposes the wire header names', () => {
    expect(SIGNATURE_HEADERS.register).toBe('x-instore-register');
    expect(SIGNATURE_HEADERS.timestamp).toBe('x-instore-timestamp');
    expect(SIGNATURE_HEADERS.nonce).toBe('x-instore-nonce');
    expect(SIGNATURE_HEADERS.signature).toBe('x-instore-signature');
  });
});
