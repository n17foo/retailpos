import { User } from '../../repositories/UserRepository';

// ── Auth method types ───────────────────────────────────────────────

/**
 * All supported authentication methods for POS login.
 * 'pin' is always the default and fallback method.
 */
export type AuthMethodType = 'pin' | 'biometric' | 'password' | 'magstripe' | 'rfid_nfc' | 'platform_auth';

/** The mode a POS installation runs in — online (e-commerce) or offline (local SQLite). */
export type AuthMode = 'online' | 'offline';

/** Human-readable metadata for each auth method */
export interface AuthMethodInfo {
  type: AuthMethodType;
  label: string;
  description: string;
  icon: string;
  /** Whether this method requires external hardware (card reader, NFC reader, etc.) */
  requiresHardware: boolean;
  /** Whether this method requires platform-level support (e.g. biometric needs OS enrollment) */
  requiresPlatformSupport: boolean;
  /**
   * Which POS modes this method supports.
   * - 'offline' = validates against local SQLite (UserRepository / KeyValueRepository)
   * - 'online'  = validates against the e-commerce platform API
   * Methods with both modes work in either setup.
   */
  supportedModes: AuthMode[];
}

/** Result of an authentication attempt */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Interface that every auth method provider must implement.
 *
 * Each provider handles one authentication method (PIN, biometric, etc.)
 * and knows how to:
 * - Check if the method is available on this device/setup
 * - Authenticate a user
 * - Enroll a user (set up credentials for this method)
 */
export interface AuthMethodProvider {
  readonly type: AuthMethodType;
  readonly info: AuthMethodInfo;

  /** Check if this auth method is available on the current device/setup */
  isAvailable(): Promise<boolean>;

  /**
   * Authenticate a user.
   * For PIN/password: credential is the entered string.
   * For biometric: credential is undefined (OS handles prompt).
   * For magstripe/RFID: credential is the scanned card data.
   */
  authenticate(credential?: string): Promise<AuthResult>;

  /**
   * Enroll a user with this auth method.
   * For PIN: stores the PIN hash.
   * For biometric: links the user's biometric to their account.
   * For magstripe/RFID: stores the card ID mapping.
   * For password: stores the password hash.
   */
  enroll(userId: string, credential: string): Promise<boolean>;

  /** Remove enrollment for a user */
  unenroll(userId: string): Promise<boolean>;

  /** Check if a specific user is enrolled with this method */
  isEnrolled(userId: string): Promise<boolean>;
}

// ── Registry of all auth methods with metadata ──────────────────────

export const AUTH_METHOD_INFO: Record<AuthMethodType, AuthMethodInfo> = {
  pin: {
    type: 'pin',
    label: '6-Digit PIN',
    description: 'Enter a 6-digit numeric code to log in. Fast and simple — ideal for most POS setups.',
    icon: '🔢',
    requiresHardware: false,
    requiresPlatformSupport: false,
    supportedModes: ['offline'],
  },
  biometric: {
    type: 'biometric',
    label: 'Fingerprint / Face ID',
    description: 'Use your fingerprint or face recognition to log in. Requires biometric hardware on the device.',
    icon: '👆',
    requiresHardware: false,
    requiresPlatformSupport: true,
    supportedModes: ['offline'],
  },
  password: {
    type: 'password',
    label: 'Password',
    description: 'Enter an alphanumeric password to log in. More secure but slower for quick cashier switches.',
    icon: '🔑',
    requiresHardware: false,
    requiresPlatformSupport: false,
    supportedModes: ['offline'],
  },
  magstripe: {
    type: 'magstripe',
    label: 'Magnetic Card Swipe',
    description: 'Swipe an employee ID card through a magnetic stripe reader. Requires a USB/Bluetooth card reader.',
    icon: '💳',
    requiresHardware: true,
    requiresPlatformSupport: false,
    supportedModes: ['offline'],
  },
  rfid_nfc: {
    type: 'rfid_nfc',
    label: 'RFID / NFC Badge',
    description: 'Tap an employee badge on an NFC or RFID reader. Requires a compatible reader device.',
    icon: '📡',
    requiresHardware: true,
    requiresPlatformSupport: false,
    supportedModes: ['offline'],
  },
  platform_auth: {
    type: 'platform_auth',
    label: 'Platform Login',
    description:
      'Authenticate using your e-commerce platform credentials (e.g. Shopify, WooCommerce). Requires an active internet connection.',
    icon: '🌐',
    requiresHardware: false,
    requiresPlatformSupport: false,
    supportedModes: ['online'],
  },
};

/** Ordered list of all auth methods (PIN first as default) */
export const ALL_AUTH_METHODS: AuthMethodType[] = ['pin', 'biometric', 'password', 'magstripe', 'rfid_nfc', 'platform_auth'];

/** Auth methods that work in offline mode (local SQLite) */
export const OFFLINE_AUTH_METHODS: AuthMethodType[] = ALL_AUTH_METHODS.filter(m => AUTH_METHOD_INFO[m].supportedModes.includes('offline'));

/** Auth methods that work in online mode (e-commerce platform) */
export const ONLINE_AUTH_METHODS: AuthMethodType[] = ALL_AUTH_METHODS.filter(m => AUTH_METHOD_INFO[m].supportedModes.includes('online'));

/** Get the auth methods available for a given mode */
export function getAuthMethodsForMode(mode: AuthMode): AuthMethodType[] {
  return ALL_AUTH_METHODS.filter(m => AUTH_METHOD_INFO[m].supportedModes.includes(mode));
}
