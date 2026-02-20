import { AuthMethodProvider, AuthMethodType, AuthResult } from './AuthMethodInterface';
import { AuthConfigService, authConfig } from './AuthConfigService';
import { PinAuthProvider } from './providers/PinAuthProvider';
import { BiometricAuthProvider } from './providers/BiometricAuthProvider';
import { PasswordAuthProvider } from './providers/PasswordAuthProvider';
import { MagstripeAuthProvider } from './providers/MagstripeAuthProvider';
import { RfidNfcAuthProvider } from './providers/RfidNfcAuthProvider';
import { PlatformAuthProvider } from './providers/PlatformAuthProvider';

/**
 * Central authentication service.
 *
 * Holds all registered auth method providers and delegates
 * authentication to the appropriate one based on the configured
 * primary/allowed methods.
 */
export class AuthService {
  private static instance: AuthService;
  private providers = new Map<AuthMethodType, AuthMethodProvider>();

  constructor(private config: AuthConfigService) {
    // Register all built-in providers
    this.registerProvider(new PinAuthProvider());
    this.registerProvider(new BiometricAuthProvider());
    this.registerProvider(new PasswordAuthProvider());
    this.registerProvider(new MagstripeAuthProvider());
    this.registerProvider(new RfidNfcAuthProvider());
    this.registerProvider(new PlatformAuthProvider());
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService(authConfig);
    }
    return AuthService.instance;
  }

  /** Reset the singleton (used by tests). */
  static resetInstance(): void {
    AuthService.instance = undefined as unknown as AuthService;
  }

  /** Register a custom auth method provider */
  registerProvider(provider: AuthMethodProvider): void {
    this.providers.set(provider.type, provider);
  }

  /** Get a specific provider by type */
  getProvider(type: AuthMethodType): AuthMethodProvider | undefined {
    return this.providers.get(type);
  }

  /** Get the primary (default) auth method provider */
  getPrimaryProvider(): AuthMethodProvider {
    const primary = this.config.primaryMethod;
    return this.providers.get(primary) ?? this.providers.get('pin')!;
  }

  /** Get all providers that are both allowed and available on this device */
  async getAvailableProviders(): Promise<AuthMethodProvider[]> {
    const allowed = this.config.allowedMethods;
    const available: AuthMethodProvider[] = [];

    for (const method of allowed) {
      const provider = this.providers.get(method);
      if (provider) {
        const isAvail = await provider.isAvailable();
        if (isAvail) {
          available.push(provider);
        }
      }
    }

    // PIN is always available as fallback
    if (!available.some(p => p.type === 'pin')) {
      const pinProvider = this.providers.get('pin');
      if (pinProvider) available.unshift(pinProvider);
    }

    return available;
  }

  /** Authenticate using a specific method */
  async authenticate(method: AuthMethodType, credential?: string): Promise<AuthResult> {
    const provider = this.providers.get(method);
    if (!provider) {
      return { success: false, error: `Authentication method '${method}' is not available.` };
    }

    const isAvail = await provider.isAvailable();
    if (!isAvail) {
      return { success: false, error: `${provider.info.label} is not available on this device.` };
    }

    return provider.authenticate(credential);
  }

  /** Authenticate using the primary method */
  async authenticateWithPrimary(credential?: string): Promise<AuthResult> {
    return this.authenticate(this.config.primaryMethod, credential);
  }
}

export const authService = AuthService.getInstance();
