import { userRepository } from '../../../repositories/UserRepository';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

const MAGSTRIPE_KEY_PREFIX = 'auth.magstripe.';
const MAGSTRIPE_ENABLED_KEY = 'auth.magstripe.enabled';

/**
 * Magnetic stripe card authentication provider.
 *
 * Users swipe an employee ID card through a USB or Bluetooth magnetic
 * stripe reader. The card data (track data or card ID) is matched
 * against stored enrollments.
 *
 * Requires external hardware — a USB HID or Bluetooth mag-stripe reader
 * that sends keystrokes (most common POS card readers work this way).
 */
export class MagstripeAuthProvider implements AuthMethodProvider {
  readonly type = 'magstripe' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.magstripe;

  async isAvailable(): Promise<boolean> {
    // Mag-stripe availability is user-configured (they tell us they have a reader)
    const enabled = await keyValueRepository.getObject<boolean>(MAGSTRIPE_ENABLED_KEY);
    return enabled === true;
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    if (!credential) {
      return { success: false, error: 'Please swipe your employee card.' };
    }

    try {
      // Normalize the card data (trim whitespace, common reader artifacts)
      const cardData = credential.trim();

      // Look up all active users and check their stored card IDs
      const users = await userRepository.findActive();

      for (const user of users) {
        const storedCardId = await keyValueRepository.getObject<string>(MAGSTRIPE_KEY_PREFIX + user.id);
        if (storedCardId && storedCardId === cardData) {
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
      await keyValueRepository.setObject(MAGSTRIPE_KEY_PREFIX + userId, credential.trim());
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
}
