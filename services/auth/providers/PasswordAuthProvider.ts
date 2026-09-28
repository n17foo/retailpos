import { userRepository } from '../../../repositories/UserRepository';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';
import { AuthAttemptLimiter } from '../AuthAttemptLimiter';
import { hashCredential, verifyCredential, isHashedCredential } from '../../../utils/crypto';

const PASSWORD_KEY_PREFIX = 'auth.password.';
const MAX_PASSWORD_LENGTH = 1024;

/**
 * Password-based authentication provider.
 *
 * Users enter an alphanumeric password to log in.
 * More secure than PIN but slower for quick cashier switches.
 * Passwords are stored salted+hashed in key_value_store keyed by user ID;
 * legacy plaintext entries are re-hashed transparently on a successful login.
 */
export class PasswordAuthProvider implements AuthMethodProvider {
  readonly type = 'password' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.password;

  private limiter = new AuthAttemptLimiter();

  async isAvailable(): Promise<boolean> {
    // Password auth is always available — no hardware needed
    return true;
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    if (!credential) {
      return { success: false, error: 'Password is required.' };
    }
    const remainingMs = this.limiter.getLockoutRemainingMs();
    if (remainingMs > 0) {
      return { success: false, error: `Too many failed attempts. Try again in ${Math.ceil(remainingMs / 1000)}s.` };
    }
    if (credential.length > MAX_PASSWORD_LENGTH) {
      this.limiter.recordResult(false);
      return { success: false, error: 'Invalid password. Please try again.' };
    }

    try {
      // Look up all active users and check their stored passwords
      const users = await userRepository.findActive();

      for (const user of users) {
        const storedPassword = await keyValueRepository.getObject<string>(PASSWORD_KEY_PREFIX + user.id);
        if (storedPassword && verifyCredential(credential, storedPassword)) {
          if (!isHashedCredential(storedPassword)) {
            // Transparent migration: re-hash legacy plaintext password on match
            await keyValueRepository.setObject(PASSWORD_KEY_PREFIX + user.id, hashCredential(credential)).catch(() => undefined);
          }
          this.limiter.recordResult(true);
          return { success: true, user };
        }
      }

      this.limiter.recordResult(false);
      return { success: false, error: 'Invalid password. Please try again.' };
    } catch {
      this.limiter.recordResult(false);
      return { success: false, error: 'Authentication failed. Please try again.' };
    }
  }

  async enroll(userId: string, credential: string): Promise<boolean> {
    if (!credential || credential.length > MAX_PASSWORD_LENGTH) return false;
    try {
      await keyValueRepository.setObject(PASSWORD_KEY_PREFIX + userId, hashCredential(credential));
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
