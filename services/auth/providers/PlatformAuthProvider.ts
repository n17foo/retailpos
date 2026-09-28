import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

const PLATFORM_AUTH_USER_KEY = 'auth.platform.userId';

/**
 * Platform authentication provider for online e-commerce platforms.
 *
 * This provider fails closed until the platform integrations support a
 * per-user identity challenge. A device-level integration token proves the
 * register can call the platform API, not that the person at the login screen
 * is the enrolled staff user.
 *
 * Enrollment metadata is retained for a future secure implementation.
 */
export class PlatformAuthProvider implements AuthMethodProvider {
  readonly type = 'platform_auth' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.platform_auth;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async authenticate(_credential?: string): Promise<AuthResult> {
    return { success: false, error: 'Platform login is unavailable. Use an enrolled staff authentication method.' };
  }

  async enroll(userId: string, _credential: string): Promise<boolean> {
    try {
      // Link a local user to platform auth
      await keyValueRepository.setObject(PLATFORM_AUTH_USER_KEY, userId);
      return true;
    } catch {
      return false;
    }
  }

  async unenroll(_userId: string): Promise<boolean> {
    try {
      await keyValueRepository.removeItem(PLATFORM_AUTH_USER_KEY);
      return true;
    } catch {
      return false;
    }
  }

  async isEnrolled(userId: string): Promise<boolean> {
    const storedId = await keyValueRepository.getObject<string>(PLATFORM_AUTH_USER_KEY);
    return storedId === userId;
  }
}
