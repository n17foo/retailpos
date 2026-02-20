import { getPlatformToken } from './TokenUtils';
import { TokenType } from './TokenServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger/LoggerFactory';
import { TokenInitializer } from './TokenInitializer';

const logger = LoggerFactory.getInstance().createLogger('TokenIntegration');

/**
 * Create an authenticated API client for a specific platform
 * This is a helper function that can be used by any service to get a pre-configured API client
 *
 * @param platform The e-commerce platform
 * @param baseUrl The base URL for the API
 * @param options Additional configuration options
 * @returns A configured API client with authentication, or null if token retrieval failed
 */
export async function createAuthenticatedApiClient(
  platform: ECommercePlatform,
  baseUrl: string,
  options: ApiClientOptions = {}
): Promise<PlatformApiClient | null> {
  try {
    // Make sure the platform token provider is initialized
    await TokenInitializer.getInstance().initializePlatformToken(platform);

    // Get the access token
    const accessToken = await getPlatformToken(platform, TokenType.ACCESS);

    if (!accessToken) {
      logger.error(`Failed to get access token for ${platform}`);
      return null;
    }

    // Return a platform-specific API client
    return createPlatformClient(platform, baseUrl, accessToken, options);
  } catch (error) {
    logger.error(
      { message: `Error creating authenticated API client for ${platform}` },
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}

/**
 * Create a platform-specific API client with the right authentication headers and configuration
 *
 * @param platform The e-commerce platform
 * @param baseUrl The base URL for the API
 * @param accessToken The access token for authentication
 * @param options Additional configuration options
 * @returns A configured API client
 */
function createPlatformClient(
  platform: ECommercePlatform,
  baseUrl: string,
  accessToken: string,
  options: ApiClientOptions
): PlatformApiClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.additionalHeaders,
  };

  // Add platform-specific authorization headers
  switch (platform) {
    case ECommercePlatform.SHOPIFY:
      headers['X-Shopify-Access-Token'] = accessToken;
      break;
    case ECommercePlatform.MAGENTO:
    case ECommercePlatform.WOOCOMMERCE:
    case ECommercePlatform.SYLIUS:
      headers['Authorization'] = `Bearer ${accessToken}`;
      break;
    case ECommercePlatform.BIGCOMMERCE:
      headers['X-Auth-Token'] = accessToken;
      break;
    case ECommercePlatform.WIX:
      headers['Authorization'] = `Bearer ${accessToken}`;
      break;
    default:
      logger.warn(`Unknown platform: ${platform}, using default Bearer token auth`);
      headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Return a simple HTTP client with the configured headers
  // In a real implementation, this could return an Axios instance or similar
  return {
    get: async (endpoint: string, _params: Record<string, unknown> = {}) => {
      logger.info(`Making GET request to ${platform} API: ${endpoint}`);
      // Here you would use fetch or axios to make the actual API call
      // This is just a placeholder implementation
      return { success: true, data: {} };
    },

    post: async (endpoint: string, _data: unknown) => {
      logger.info(`Making POST request to ${platform} API: ${endpoint}`);
      // Here you would use fetch or axios to make the actual API call
      // This is just a placeholder implementation
      return { success: true, data: {} };
    },

    put: async (endpoint: string, _data: unknown) => {
      logger.info(`Making PUT request to ${platform} API: ${endpoint}`);
      // Here you would use fetch or axios to make the actual API call
      // This is just a placeholder implementation
      return { success: true, data: {} };
    },

    delete: async (endpoint: string) => {
      logger.info(`Making DELETE request to ${platform} API: ${endpoint}`);
      // Here you would use fetch or axios to make the actual API call
      // This is just a placeholder implementation
      return { success: true, data: {} };
    },

    // Add custom request function
    request: async (method: string, endpoint: string, _options: Record<string, unknown> = {}) => {
      logger.info(`Making ${method} request to ${platform} API: ${endpoint}`);
      // Here you would use fetch or axios to make the actual API call
      // This is just a placeholder implementation
      return { success: true, data: {} };
    },
  };
}

/**
 * Options for creating an API client
 */
export interface ApiClientOptions {
  additionalHeaders?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * Standard response shape from platform API calls
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
}

/**
 * Authenticated HTTP client for platform API calls
 */
export interface PlatformApiClient {
  get(endpoint: string, params?: Record<string, unknown>): Promise<ApiResponse>;
  post(endpoint: string, data: unknown): Promise<ApiResponse>;
  put(endpoint: string, data: unknown): Promise<ApiResponse>;
  delete(endpoint: string): Promise<ApiResponse>;
  request(method: string, endpoint: string, options?: Record<string, unknown>): Promise<ApiResponse>;
}

/**
 * Wrap an API call with automatic token refresh if needed
 * This is helpful for handling cases where a token expires during a request
 *
 * @param platform The platform to use for the API call
 * @param apiCallFn The API call function to execute
 * @returns The result of the API call
 */
export async function withTokenRefresh<T>(platform: ECommercePlatform, apiCallFn: (token: string) => Promise<T>): Promise<T> {
  try {
    // Get token and make API call
    const token = await getPlatformToken(platform);
    if (!token) {
      throw new Error(`No token available for ${platform}`);
    }

    try {
      // Try the API call with current token
      return await apiCallFn(token);
    } catch (error) {
      // If we get an authentication error, try refreshing the token
      if (isAuthenticationError(error)) {
        logger.info(`Authentication error, refreshing token for ${platform}`);

        // Force token refresh and try again
        const newToken = await getPlatformToken(platform, TokenType.ACCESS, true);
        if (!newToken) {
          throw new Error(`Failed to refresh token for ${platform}`);
        }

        // Retry with new token
        return await apiCallFn(newToken);
      }

      // If it's not an authentication error, rethrow
      throw error;
    }
  } catch (error) {
    logger.error(
      { message: `API call with token refresh failed for ${platform}` },
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Check if an error is an authentication error
 * This is a simple helper function to identify when token refresh is needed
 *
 * @param error The error to check
 * @returns True if it's an authentication error
 */
function isAuthenticationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const err = error as Record<string, unknown>;

  // Check for common authentication error patterns
  if (err.status === 401 || err.statusCode === 401) {
    return true;
  }

  const response = err.response as Record<string, unknown> | undefined;
  if (response?.status === 401) {
    return true;
  }

  const message = typeof err.message === 'string' ? err.message : '';
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return true;
  }

  return false;
}
