import { userRepository } from '../../../repositories/UserRepository';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';
import { cardReaderDetection } from '../CardReaderDetection';
import { hashCredential, verifyCredential, isHashedCredential } from '../../../utils/crypto';

const MAGSTRIPE_KEY_PREFIX = 'auth.magstripe.';
const MAGSTRIPE_ENABLED_KEY = 'auth.magstripe.enabled';
const MAGSTRIPE_AUTO_DETECT_KEY = 'auth.magstripe.autoDetect';

/**
 * Magnetic stripe card authentication provider.
 *
 * Users swipe an employee ID card through a USB or Bluetooth magnetic
 * stripe reader. The card data (track data or card ID) is matched
 * against stored enrollments.
 *
 * Requires external hardware — a USB HID or Bluetooth mag-stripe reader
 * that sends keystrokes (most common POS card readers work this way).
 *
 * Supports auto-detection of USB HID card readers on Electron.
 */
export class MagstripeAuthProvider implements AuthMethodProvider {
  readonly type = 'magstripe' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.magstripe;

  async isAvailable(): Promise<boolean> {
    // Check if auto-detection is enabled
    const autoDetect = await keyValueRepository.getObject<boolean>(MAGSTRIPE_AUTO_DETECT_KEY);

    if (autoDetect !== false) {
      // Try auto-detection (Electron only)
      try {
        const readers = await cardReaderDetection.detectReaders();
        if (readers.length > 0) {
          // Auto-enable if readers detected
          await keyValueRepository.setObject(MAGSTRIPE_ENABLED_KEY, true);
          return true;
        }
      } catch {
        // Auto-detection failed, fall through to manual check
      }
    }

    // Fall back to manual configuration
    const enabled = await keyValueRepository.getObject<boolean>(MAGSTRIPE_ENABLED_KEY);
    return enabled === true;
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    if (!credential) {
      return { success: false, error: 'Please swipe your employee card.' };
    }

    try {
      // Parse and validate card data
      const employeeId = cardReaderDetection.extractEmployeeId(credential);

      if (!employeeId) {
        return { success: false, error: 'Invalid card data. Please try again.' };
      }

      // Look up all active users and check their stored card IDs
      const users = await userRepository.findActive();

      for (const user of users) {
        const storedCardId = await keyValueRepository.getObject<string>(MAGSTRIPE_KEY_PREFIX + user.id);
        if (storedCardId && verifyCredential(employeeId, storedCardId)) {
          if (!isHashedCredential(storedCardId)) {
            // Transparent migration: re-hash legacy plaintext card ID on match
            await keyValueRepository.setObject(MAGSTRIPE_KEY_PREFIX + user.id, hashCredential(employeeId)).catch(() => undefined);
          }
          return { success: true, user };
        }
      }

      return { success: false, error: 'Card not recognized. Please try again or use another login method.' };
    } catch {
      return { success: false, error: 'Card authentication failed. Please try again.' };
    }
  }

  async enroll(userId: string, credential: string): Promise<boolean> {
    try {
      // Extract employee ID from card data
      const employeeId = cardReaderDetection.extractEmployeeId(credential);

      if (!employeeId) {
        return false;
      }

      await keyValueRepository.setObject(MAGSTRIPE_KEY_PREFIX + userId, hashCredential(employeeId));
      return true;
    } catch {
      return false;
    }
  }

  async unenroll(userId: string): Promise<boolean> {
    try {
      await keyValueRepository.removeItem(MAGSTRIPE_KEY_PREFIX + userId);
      return true;
    } catch {
      return false;
    }
  }

  async isEnrolled(userId: string): Promise<boolean> {
    const stored = await keyValueRepository.getObject<string>(MAGSTRIPE_KEY_PREFIX + userId);
    return stored !== null;
  }

  /** Mark that the store has a mag-stripe reader available */
  async setHardwareAvailable(available: boolean): Promise<void> {
    await keyValueRepository.setObject(MAGSTRIPE_ENABLED_KEY, available);
  }

  /** Enable/disable auto-detection of card readers */
  async setAutoDetect(enabled: boolean): Promise<void> {
    await keyValueRepository.setObject(MAGSTRIPE_AUTO_DETECT_KEY, enabled);
  }

  /** Get list of detected card readers */
  async getDetectedReaders() {
    return await cardReaderDetection.detectReaders();
  }
}
