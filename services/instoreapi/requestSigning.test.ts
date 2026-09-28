import { signRequest, verifyRequestSignature, SIGNATURE_HEADERS, SIGNATURE_WINDOW_MS } from './requestSigning';

const SECRET = 'instore-test-secret';

function headersFrom(signed: { timestamp: string; nonce: string; signature: string }, registerId = 'reg-1') {
  return {
    [SIGNATURE_HEADERS.register]: registerId,
    [SIGNATURE_HEADERS.timestamp]: signed.timestamp,
    [SIGNATURE_HEADERS.nonce]: signed.nonce,
    [SIGNATURE_HEADERS.signature]: signed.signature,
  };
}

describe('requestSigning', () => {
  it('verifies a signature it produced', () => {
    const signed = signRequest(SECRET, 'GET', '/api/orders?status=paid', '');
    const result = verifyRequestSignature(SECRET, 'GET', '/api/orders?status=paid', '', headersFrom(signed));
    expect(result).toEqual({ ok: true, registerId: 'reg-1' });
  });

  it('covers the request body', () => {
    const signed = signRequest(SECRET, 'POST', '/api/orders', '{"a":1}');
    expect(verifyRequestSignature(SECRET, 'POST', '/api/orders', '{"a":1}', headersFrom(signed)).ok).toBe(true);
    // Tampered body must fail
    expect(verifyRequestSignature(SECRET, 'POST', '/api/orders', '{"a":2}', headersFrom(signed)).ok).toBe(false);
  });

  it('covers the path, query and method', () => {
    const signed = signRequest(SECRET, 'GET', '/api/orders/abc', '');
    expect(verifyRequestSignature(SECRET, 'GET', '/api/orders/xyz', '', headersFrom(signed)).ok).toBe(false);
    expect(verifyRequestSignature(SECRET, 'POST', '/api/orders/abc', '', headersFrom(signed)).ok).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const signed = signRequest('other-secret', 'GET', '/api/users', '');
    expect(verifyRequestSignature(SECRET, 'GET', '/api/users', '', headersFrom(signed)).ok).toBe(false);
  });

  it('rejects stale timestamps', () => {
    const signed = signRequest(SECRET, 'GET', '/api/users', '');
    const stale = { ...signed, timestamp: String(Date.now() - SIGNATURE_WINDOW_MS - 1000) };
    expect(verifyRequestSignature(SECRET, 'GET', '/api/users', '', headersFrom(stale)).ok).toBe(false);
  });

  it('rejects future timestamps beyond the window', () => {
    const signed = signRequest(SECRET, 'GET', '/api/users', '');
    const future = { ...signed, timestamp: String(Date.now() + SIGNATURE_WINDOW_MS + 1000) };
    expect(verifyRequestSignature(SECRET, 'GET', '/api/users', '', headersFrom(future)).ok).toBe(false);
  });

  it('rejects missing and malformed headers', () => {
    expect(verifyRequestSignature(SECRET, 'GET', '/api/users', '', {}).ok).toBe(false);

    const signed = signRequest(SECRET, 'GET', '/api/users', '');
    expect(verifyRequestSignature(SECRET, 'GET', '/api/users', '', headersFrom({ ...signed, signature: 'nothex' })).ok).toBe(false);
    expect(verifyRequestSignature(SECRET, 'GET', '/api/users', '', headersFrom({ ...signed, nonce: '' })).ok).toBe(false);
  });

  it('produces unique nonces', () => {
    const a = signRequest(SECRET, 'GET', '/api/users', '');
    const b = signRequest(SECRET, 'GET', '/api/users', '');
    expect(a.nonce).not.toBe(b.nonce);
  });
});
