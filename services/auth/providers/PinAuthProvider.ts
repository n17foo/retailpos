import { userRepository } from '../../../repositories/UserRepository';
import { instoreApiConfig } from '../../instoreapi/InstoreApiConfig';
import { instoreApiClient } from '../../clients/instoreapi/InstoreApiClient';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

/**
 * PIN-based authentication provider.
 * This is the default and always-available auth method.
 * Users enter a 6-digit numeric PIN to log in.
 *
 * In client mode (multi-register), PINs are verified against the store-api
 * so that user management is centralised on the server register.
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
      // In client mode, verify against the store-api (centralised user management)
      if (instoreApiConfig.isClient) {
        return this.authenticateViaStoreApi(credential);
      }

      // Local mode (standalone or server) — verify against local SQLite
      return this.authenticateLocally(credential);
    } catch {
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

  // ── Private ─────────────────────────────────────────────────────────

  private async authenticateLocally(credential: string): Promise<AuthResult> {
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
  }

  private async authenticateViaStoreApi(credential: string): Promise<AuthResult> {
    const user = await instoreApiClient.verifyPin(credential);
    if (user) {
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role as 'admin' | 'manager' | 'cashier',
          pin: '', // never store the PIN from the server
          is_active: true,
          created_at: 0,
          updated_at: 0,
        },
      };
    }

    return { success: false, error: 'Invalid PIN. Please try again.' };
  }
}
