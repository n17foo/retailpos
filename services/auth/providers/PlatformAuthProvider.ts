import { keyValueRepository } from '../../../repositories/KeyValueRepository';
import { AuthMethodProvider, AuthMethodInfo, AuthResult, AUTH_METHOD_INFO } from '../AuthMethodInterface';
import { ECommercePlatform, isOnlinePlatform } from '../../../utils/platforms';
import { TokenService } from '../../token/TokenService';
import { TokenType } from '../../token/TokenServiceInterface';

const PLATFORM_AUTH_USER_KEY = 'auth.platform.userId';

/**
 * Platform authentication provider for online e-commerce platforms.
 *
 * Validates the user's credentials against the configured e-commerce
 * platform API (Shopify, WooCommerce, etc.) using the existing
 * TokenService infrastructure.
 *
 * This method is only available when an online platform is configured.
 * It requires an active internet connection.
 */
export class PlatformAuthProvider implements AuthMethodProvider {
  readonly type = 'platform_auth' as const;
  readonly info: AuthMethodInfo = AUTH_METHOD_INFO.platform_auth;

  /** Resolve the currently configured platform from KV store */
  private async getConfiguredPlatform(): Promise<ECommercePlatform | null> {
    const platform = await keyValueRepository.getItem('ecommercePlatform');
    if (!platform) return null;
    const p = platform as ECommercePlatform;
    return isOnlinePlatform(p) ? p : null;
  }

  async isAvailable(): Promise<boolean> {
    const platform = await this.getConfiguredPlatform();
    if (!platform) return false;

    // Check if we have a valid token for the platform
    const tokenService = TokenService.getInstance();
    return tokenService.hasValidToken(platform, TokenType.ACCESS);
  }

  async authenticate(credential?: string): Promise<AuthResult> {
    const platform = await this.getConfiguredPlatform();
    if (!platform) {
      return { success: false, error: 'No online platform is configured.' };
    }

    try {
      const tokenService = TokenService.getInstance();

      // If credential is provided, treat it as an API key / access token to validate
      if (credential) {
        // Store the provided credential as the platform access token
        await tokenService.storeToken(platform, TokenType.ACCESS, credential);
      }

      // Verify we have a valid token
      const hasToken = await tokenService.hasValidToken(platform, TokenType.ACCESS);
      if (!hasToken) {
        // Try to refresh
        const token = await tokenService.getToken(platform, TokenType.ACCESS, true);
        if (!token) {
          return {
            success: false,
            error: 'Platform authentication failed. Please check your credentials and internet connection.',
          };
        }
      }

      // Retrieve the linked local user (if any)
      const userId = await keyValueRepository.getObject<string>(PLATFORM_AUTH_USER_KEY);

      // Platform auth succeeded — return with optional local user link
      return {
        success: true,
        user: userId
          ? ((await (await import('../../../repositories/UserRepository')).userRepository.findById(userId)) ?? undefined)
          : undefined,
      };
    } catch {
      return { success: false, error: 'Platform authentication failed. Please try again.' };
    }
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
