import { Platform } from 'react-native';
import { userRepository } from '../../../repositories/UserRepository';
import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';

const BIOMETRIC_USER_KEY = 'auth.biometric.userId';

/** Minimal shape of expo-local-authentication used by this provider */
interface LocalAuthModule {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  authenticateAsync(options: {
    promptMessage: string;
    cancelLabel?: string;
    disableDeviceFallback?: boolean;
  }): Promise<{ success: boolean; error?: string }>;
}

/**
 * Biometric authentication provider (fingerprint / Face ID).
 *
 * Uses expo-local-authentication when available. Falls back to
 * unavailable if the package is not installed or the device lacks
 * biometric hardware.
 *
 * Enrollment links a user ID to the device's biometric — only one
 * user can be the "biometric user" per device.
 */
export class BiometricAuthProvider implements AuthMethodProvider {
  readonly type = 'biometric' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.biometric;

  private getLocalAuth(): LocalAuthModule | null {
    try {
      // Dynamic require so the app doesn't crash if the package isn't installed

      return require('expo-local-authentication') as LocalAuthModule;
    } catch {
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    // Biometrics only work on native platforms
    if (Platform.OS === 'web') return false;

    const LocalAuth = this.getLocalAuth();
    if (!LocalAuth) return false;

    try {
      const hasHardware = await LocalAuth.hasHardwareAsync();
      const isEnrolled = await LocalAuth.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  }

  async authenticate(_credential?: string): Promise<AuthResult> {
    const LocalAuth = this.getLocalAuth();
    if (!LocalAuth) {
      return { success: false, error: 'Biometric authentication is not available on this device.' };
    }

    try {
      const result = await LocalAuth.authenticateAsync({
        promptMessage: 'Log in to RetailPOS',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
      });

      if (!result.success) {
        return { success: false, error: 'Biometric authentication cancelled or failed.' };
      }

      // Look up which user is linked to biometric on this device
      const userId = await keyValueRepository.getObject<string>(BIOMETRIC_USER_KEY);
      if (!userId) {
        return { success: false, error: 'No user is enrolled for biometric login. Please set up in Settings.' };
      }

      const user = await userRepository.findById(userId);
      if (!user || !user.is_active) {
        return { success: false, error: 'Enrolled user not found or inactive.' };
      }

      return { success: true, user };
    } catch {
      return { success: false, error: 'Biometric authentication failed.' };
    }
  }

  async enroll(userId: string, _credential: string): Promise<boolean> {
    try {
      // Store the user ID linked to biometric on this device
      await keyValueRepository.setObject(BIOMETRIC_USER_KEY, userId);
      return true;
    } catch {
      return false;
    }
  }

  async unenroll(_userId: string): Promise<boolean> {
    try {
      await keyValueRepository.removeItem(BIOMETRIC_USER_KEY);
      return true;
    } catch {
      return false;
    }
  }

  async isEnrolled(userId: string): Promise<boolean> {
    const storedId = await keyValueRepository.getObject<string>(BIOMETRIC_USER_KEY);
    return storedId === userId;
  }
}
