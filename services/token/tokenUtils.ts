import { TokenServiceFactory } from './tokenServiceFactory';
import { TokenType } from './tokenServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger';

const logger = LoggerFactory.getInstance().createLogger('TokenUtils');

/**
 * Helper function to get a token for a specific platform
 * Initializes the token provider if needed
 *
 * @param platform The platform to get the token for
 * @param tokenType The type of token to retrieve
 * @param forceRefresh Whether to force a token refresh
 * @returns The token or null if not available
 */
export async function getPlatformToken(
  platform: ECommercePlatform,
  tokenType: TokenType = TokenType.ACCESS,
  forceRefresh: boolean = false
): Promise<string | null> {
  try {
    const tokenServiceFactory = TokenServiceFactory.getInstance();
    const tokenService = tokenServiceFactory.getService();

    // Make sure the platform provider is initialized
    if (!(await tokenServiceFactory.initializePlatformProvider(platform))) {
      logger.error(`Failed to initialize token provider for platform: ${platform}`);
      return null;
    }

    // Get or refresh the token
    return await tokenService.getToken(platform, tokenType, forceRefresh);
  } catch (error) {
    logger.error({ message: `Error getting token for platform: ${platform}` }, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Helper function to check if a valid token exists for a platform
 *
 * @param platform The platform to check
 * @param tokenType The type of token to check
 * @returns True if a valid token exists
 */
export async function hasValidPlatformToken(platform: ECommercePlatform, tokenType: TokenType = TokenType.ACCESS): Promise<boolean> {
  try {
    const tokenService = TokenServiceFactory.getInstance().getService();
    return await tokenService.hasValidToken(platform, tokenType);
  } catch (error) {
    logger.error(
      { message: `Error checking token validity for platform: ${platform}` },
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}

/**
 * Helper function to store a token for a platform
 *
 * @param platform The platform to store the token for
 * @param tokenType The type of token to store
 * @param token The token value
 * @param expiresIn Optional expiration time in seconds
 * @returns True if storage was successful
 */
export async function storePlatformToken(
  platform: ECommercePlatform,
  tokenType: TokenType,
  token: string,
  expiresIn?: number
): Promise<boolean> {
  try {
    const tokenService = TokenServiceFactory.getInstance().getService();
    return await tokenService.storeToken(platform, tokenType, token, expiresIn);
  } catch (error) {
    logger.error({ message: `Error storing token for platform: ${platform}` }, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Helper function to clear all tokens for a platform
 *
 * @param platform The platform to clear tokens for
 */
export async function clearPlatformTokens(platform: ECommercePlatform): Promise<void> {
  try {
    const tokenService = TokenServiceFactory.getInstance().getService();
    await tokenService.clearPlatformTokens(platform);
  } catch (error) {
    logger.error({ message: `Error clearing tokens for platform: ${platform}` }, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Wraps an API call with automatic token refresh capability
 * If the API call fails with an authorization error, it will attempt to refresh the token and retry
 *
 * @param platform The platform to get tokens for
 * @param apiCallFn The API call function to wrap
 * @returns The result of the API call
 */
export async function withTokenRefresh<T>(platform: ECommercePlatform, apiCallFn: () => Promise<T>): Promise<T> {
  try {
    // First attempt with current token
    return await apiCallFn();
  } catch (error) {
    const refreshLogger = LoggerFactory.getInstance().createLogger('TokenRefresh');

    // Check if this is an auth error (401 Unauthorized)
    // This is a simplistic check - in production, you'd need more sophisticated error detection
    const isAuthError =
      error instanceof Error &&
      (error.message.includes('401') ||
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('unauthenticated') ||
        error.message.toLowerCase().includes('invalid token'));

    if (isAuthError) {
      refreshLogger.info(`Detected auth error for ${platform}, attempting token refresh`);

      // Force refresh the token
      const newToken = await getPlatformToken(platform, TokenType.ACCESS, true);

      if (newToken) {
        refreshLogger.info(`Successfully refreshed token for ${platform}, retrying API call`);
        // Retry the API call with the new token
        return await apiCallFn();
      } else {
        refreshLogger.error(`Failed to refresh token for ${platform}`);
        throw error;
      }
    }

    // If it's not an auth error or token refresh failed, rethrow
    throw error;
  }
}
