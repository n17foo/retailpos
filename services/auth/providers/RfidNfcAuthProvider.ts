import { userRepository } from '../../../repositories/UserRepository';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

const RFID_KEY_PREFIX = 'auth.rfid.';
const RFID_ENABLED_KEY = 'auth.rfid.enabled';

/**
 * RFID / NFC badge authentication provider.
 *
 * Users tap an employee badge on an NFC or RFID reader to log in.
 * The badge UID is matched against stored enrollments.
 *
 * Requires external hardware — a USB HID or Bluetooth NFC/RFID reader.
 * On mobile devices with built-in NFC, the device NFC can also be used.
 */
export class RfidNfcAuthProvider implements AuthMethodProvider {
  readonly type = 'rfid_nfc' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.rfid_nfc;

  async isAvailable(): Promise<boolean> {
    // RFID/NFC availability is user-configured (they tell us they have a reader)
    const enabled = await keyValueRepository.getObject<boolean>(RFID_ENABLED_KEY);
    return enabled === true;
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    if (!credential) {
      return { success: false, error: 'Please tap your employee badge.' };
    }

    try {
      const badgeId = credential.trim().toUpperCase();

      // Look up all active users and check their stored badge IDs
      const users = await userRepository.findActive();

      for (const user of users) {
        const storedBadgeId = await keyValueRepository.getObject<string>(RFID_KEY_PREFIX + user.id);
        if (storedBadgeId && storedBadgeId === badgeId) {
          return { success: true, user };
        }
      }

      return { success: false, error: 'Badge not recognized. Please try again or use another login method.' };
    } catch {
      return { success: false, error: 'Badge authentication failed. Please try again.' };
    }
  }

  async enroll(userId: string, credential: string): Promise<boolean> {
    try {
      await keyValueRepository.setObject(RFID_KEY_PREFIX + userId, credential.trim().toUpperCase());
      return true;
    } catch {
      return false;
    }
  }

  async unenroll(userId: string): Promise<boolean> {
    try {
      await keyValueRepository.removeItem(RFID_KEY_PREFIX + userId);
      return true;
    } catch {
      return false;
    }
  }

  async isEnrolled(userId: string): Promise<boolean> {
    const stored = await keyValueRepository.getObject<string>(RFID_KEY_PREFIX + userId);
    return stored !== null;
  }

  /** Mark that the store has an RFID/NFC reader available */
  async setHardwareAvailable(available: boolean): Promise<void> {
    await keyValueRepository.setObject(RFID_ENABLED_KEY, available);
  }
}
