import { userRepository } from '../../../repositories/UserRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

/**
 * PIN-based authentication provider.
 * This is the default and always-available auth method.
 * Users enter a 6-digit numeric PIN to log in.
 */
export class PinAuthProvider implements AuthMethodProvider {
  readonly type = 'pin' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.pin;

  async isAvailable(): Promise<boolean> {
    // PIN is always available — no hardware or platform requirements
    return true;
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    if (!credential) {
      return { success: false, error: 'PIN is required' };
    }

    try {
      // Check if there are any users in the system
      const hasUsers = await userRepository.hasAdminUser();

      if (!hasUsers) {
        // No users exist — allow any PIN for initial setup
        return { success: true };
      }

      const user = await userRepository.findByPin(credential);
      if (user) {
        return { success: true, user };
      }

      return { success: false, error: 'Invalid PIN. Please try again.' };
    } catch (err) {
      return { success: false, error: 'Authentication failed. Please try again.' };
    }
  }

  async enroll(userId: string, credential: string): Promise<boolean> {
    try {
      await userRepository.updatePin(userId, credential);
      return true;
    } catch {
      return false;
    }
  }

  async unenroll(_userId: string): Promise<boolean> {
    // PIN cannot be unenrolled — it's the fallback method
    return false;
  }

  async isEnrolled(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    return user !== null && !!user.pin;
  }
}
