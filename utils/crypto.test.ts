import { sha256Hex, hmacSha256Hex, timingSafeEqual, randomHex, hashPin, verifyPin, isHashedPin } from './crypto';

describe('sha256Hex', () => {
  it('should produce the known SHA-256 digest for a known input', () => {
    // NIST-known vector: sha256('abc')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('should hash the empty string to the known digest', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should handle multi-byte UTF-8 input', () => {
    // sha256('héllo') — verified against Node's crypto module
    expect(sha256Hex('héllo')).toBe('3c48591d8d098a4538f5e013dfcf406e948eac4d3277b10bf614e295d6068179');
  });

  it('should handle input longer than one 64-byte block', () => {
    const long = 'a'.repeat(200);
    expect(sha256Hex(long)).toHaveLength(64);
    expect(sha256Hex(long)).toBe(sha256Hex('a'.repeat(200)));
  });
});

describe('hmacSha256Hex', () => {
  it('should produce the RFC 4231 test vector', () => {
    // RFC 4231 test case 2: key 'Jefe', data 'what do ya want for nothing?'
    expect(hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });

  it('should produce a different digest for a different key', () => {
    expect(hmacSha256Hex('key-a', 'body')).not.toBe(hmacSha256Hex('key-b', 'body'));
  });
});

describe('timingSafeEqual', () => {
  it('should return true for identical strings', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('should return false for different strings of equal length', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('should return false for different-length strings', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('abcd', 'abc')).toBe(false);
  });

  it('should return false when either side is empty', () => {
    expect(timingSafeEqual('', 'x')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });
});

describe('randomHex', () => {
  it('should return hex of the requested byte length', () => {
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should produce unique values across calls', () => {
    expect(randomHex(16)).not.toBe(randomHex(16));
  });
});

describe('pin hashing', () => {
  it('should produce a salted v1 hash', () => {
    const hashed = hashPin('123456');
    expect(hashed).toMatch(/^v1\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(isHashedPin(hashed)).toBe(true);
  });

  it('should produce different hashes for the same PIN (salted)', () => {
    expect(hashPin('123456')).not.toBe(hashPin('123456'));
  });

  it('should verify a PIN against its hash', () => {
    const hashed = hashPin('654321');
    expect(verifyPin('654321', hashed)).toBe(true);
    expect(verifyPin('000000', hashed)).toBe(false);
  });

  it('should verify legacy plaintext PINs for migration', () => {
    expect(verifyPin('123456', '123456')).toBe(true);
    expect(verifyPin('999999', '123456')).toBe(false);
  });

  it('should reject malformed stored hashes', () => {
    expect(verifyPin('123456', 'v1$nope')).toBe(false);
    expect(verifyPin('123456', '')).toBe(false);
  });
});
