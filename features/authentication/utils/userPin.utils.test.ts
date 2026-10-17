/**
 * userPin.utils — unit tests
 *
 * Tests PIN format validation rules.
 */

import { validatePinFormat } from './userPin.utils';

describe('validatePinFormat', () => {
  // ── Valid PINs ───────────────────────────────────────────────────────

  it('passes for a 6-digit numeric PIN', () => {
    expect(validatePinFormat('123456').isValid).toBe(true);
  });

  it('passes for all zeros', () => {
    expect(validatePinFormat('000000').isValid).toBe(true);
  });

  it('passes for all nines', () => {
    expect(validatePinFormat('999999').isValid).toBe(true);
  });

  // ── Too short / too long ─────────────────────────────────────────────

  it('fails for a 5-digit PIN', () => {
    const result = validatePinFormat('12345');
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/6 digits/i);
  });

  it('fails for a 7-digit PIN', () => {
    expect(validatePinFormat('1234567').isValid).toBe(false);
  });

  it('fails for an empty string', () => {
    expect(validatePinFormat('').isValid).toBe(false);
  });

  // ── Non-numeric characters ───────────────────────────────────────────

  it('fails when PIN contains letters', () => {
    expect(validatePinFormat('12345a').isValid).toBe(false);
  });

  it('fails when PIN contains spaces', () => {
    expect(validatePinFormat('123 56').isValid).toBe(false);
  });

  it('fails when PIN contains special characters', () => {
    expect(validatePinFormat('123!56').isValid).toBe(false);
  });

  it('fails for a PIN with a leading space', () => {
    expect(validatePinFormat(' 12345').isValid).toBe(false);
  });
});
