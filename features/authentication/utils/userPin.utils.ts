/**
 * Pure PIN validation utilities extracted from useUsers.
 * No React, no RN, no repository dependencies.
 */

export interface PinValidationResult {
  isValid: boolean;
  error?: string;
}

/** PIN must be exactly 6 numeric digits. */
export function validatePinFormat(pin: string): PinValidationResult {
  if (!/^\d{6}$/.test(pin)) {
    return { isValid: false, error: 'PIN must be exactly 6 digits' };
  }
  return { isValid: true };
}
