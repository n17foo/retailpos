import { userRepository } from '../../../repositories/UserRepository';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

const PASSWORD_KEY_PREFIX = 'auth.password.';

/**
 * Password-based authentication provider.
 *
 * Users enter an alphanumeric password to log in.
 * More secure than PIN but slower for quick cashier switches.
 * Passwords are stored as JSON strings in key_value_store keyed by user ID.
 */
export class PasswordAuthProvider implements AuthMethodProvider {
  readonly type = 'password' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.password;

  async isAvailable(): Promise<boolean> {
    // Password auth is always available — no hardware needed
    return true;
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    if (!credential) {
      return { success: false, error: 'Password is required.' };
    }

    try {
      // Look up all active users and check their stored passwords
      const users = await userRepository.findActive();

      for (const user of users) {
        const storedPassword = await keyValueRepository.getObject<string>(PASSWORD_KEY_PREFIX + user.id);
        if (storedPassword && storedPassword === credential) {
          return { success: true, user };
        }
      }

      return { success: false, error: 'Invalid password. Please try again.' };
    } catch {
      return { success: false, error: 'Authentication failed. Please try again.' };
    }
  }

  async enroll(userId: string, credential: string): Promise<boolean> {
    try {
      await keyValueRepository.setObject(PASSWORD_KEY_PREFIX + userId, credential);
      return true;
    } catch {
      return false;
    }
  }

  async unenroll(userId: string): Promise<boolean> {
    try {
      await keyValueRepository.removeItem(PASSWORD_KEY_PREFIX + userId);
      return true;
    } catch {
      return false;
    }
  }

  async isEnrolled(userId: string): Promise<boolean> {
    const stored = await keyValueRepository.getObject<string>(PASSWORD_KEY_PREFIX + userId);
    return stored !== null;
  }
}
