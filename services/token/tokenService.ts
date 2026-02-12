import { TokenServiceInterface, TokenType, TokenInfo, TokenProviderFunction } from './tokenServiceInterface';
import { LoggerFactory } from '../logger/loggerFactory';
import { keyValueRepository } from '../../repositories/KeyValueRepository';

/**
 * TokenService implementation that uses SQLite for persistent token storage
 * and provider functions to manage platform tokens
 */
export class TokenService implements TokenServiceInterface {
  private static instance: TokenService;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private tokenProviders: Map<string, TokenProviderFunction> = new Map();
  private tokenRefreshPromises: Map<string, Promise<string | null>> = new Map();

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('TokenService');
    this.logger.info('TokenService initialized with SQLite storage');
  }

  /**
   * Get the singleton instance of TokenService
   */
  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * Store a token for a platform
   */
  public async storeToken(platform: string, tokenType: TokenType, token: string, expiresIn?: number): Promise<boolean> {
    try {
      const key = this.getStorageKey(platform, tokenType);
      const tokenInfo: TokenInfo = {
        token,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
      };

      await keyValueRepository.setItem(key, tokenInfo);

      this.logger.info(`Token stored for platform: ${platform}, type: ${tokenType}`);
      return true;
    } catch (error) {
      this.logger.error({ message: `Error storing token for ${platform}` }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get a token for a platform
   */
  public async getToken(platform: string, tokenType: TokenType, forceRefresh: boolean = false): Promise<string | null> {
    try {
      // Check if there's an ongoing token refresh operation for this platform/type
      const refreshKey = `${platform}:${tokenType}:refresh`;
      if (this.tokenRefreshPromises.has(refreshKey)) {
        return (await this.tokenRefreshPromises.get(refreshKey)) as string | null;
      }

      // Check storage first
      const tokenInfo = await this.getTokenFromStorage(platform, tokenType);

      // If token exists, is valid, and no refresh is requested, return it
      if (
        tokenInfo &&
        tokenInfo.token &&
        !forceRefresh &&
        (!tokenInfo.expiresAt || tokenInfo.expiresAt > Date.now() + 60000) // Not expired or expires in > 1 minute
      ) {
        return tokenInfo.token;
      }

      // Otherwise try to refresh token using provider
      if (this.tokenProviders.has(platform)) {
        const refreshPromise = this.refreshTokenUsingProvider(platform, tokenType);
        this.tokenRefreshPromises.set(refreshKey, refreshPromise);

        try {
          const newToken = await refreshPromise;
          return newToken;
        } finally {
          this.tokenRefreshPromises.delete(refreshKey);
        }
      }

      // If no provider or provider failed, return existing token even if expired
      return tokenInfo?.token || null;
    } catch (error) {
      this.logger.error({ message: `Error retrieving token for ${platform}` }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Check if a valid token exists
   */
  public async hasValidToken(platform: string, tokenType: TokenType): Promise<boolean> {
    try {
      const tokenInfo = await this.getTokenFromStorage(platform, tokenType);
      if (!tokenInfo || !tokenInfo.token) {
        return false;
      }

      // If no expiration, consider it valid
      if (!tokenInfo.expiresAt) {
        return true;
      }

      // Check if token is expired
      return tokenInfo.expiresAt > Date.now();
    } catch (error) {
      this.logger.error(
        { message: `Error checking token validity for ${platform}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Clear all tokens for a platform
   */
  public async clearPlatformTokens(platform: string): Promise<void> {
    try {
      const keys = Object.values(TokenType).map(type => this.getStorageKey(platform, type as TokenType));

      for (const key of keys) {
        await keyValueRepository.removeItem(key);
      }

      this.logger.info(`All tokens cleared for platform: ${platform}`);
    } catch (error) {
      this.logger.error({ message: `Error clearing tokens for ${platform}` }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Clear a specific token for a platform
   */
  public async clearToken(platform: string, tokenType: TokenType): Promise<void> {
    try {
      const key = this.getStorageKey(platform, tokenType);

      await keyValueRepository.removeItem(key);

      this.logger.info(`Token cleared for platform: ${platform}, type: ${tokenType}`);
    } catch (error) {
      this.logger.error({ message: `Error clearing token for ${platform}` }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Register a token provider
   */
  public registerTokenProvider(platform: string, provider: TokenProviderFunction): void {
    this.tokenProviders.set(platform, provider);
    this.logger.info(`Token provider registered for platform: ${platform}`);
  }

  /**
   * Helper to get token from storage
   */
  private async getTokenFromStorage(platform: string, tokenType: TokenType): Promise<TokenInfo | null> {
    try {
      const key = this.getStorageKey(platform, tokenType);
      return await keyValueRepository.getObject<TokenInfo>(key);
    } catch (error) {
      this.logger.error(
        { message: `Error reading token from storage for ${platform}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Refresh a token using its provider
   */
  private async refreshTokenUsingProvider(platform: string, tokenType: TokenType): Promise<string | null> {
    try {
      const provider = this.tokenProviders.get(platform);
      if (!provider) {
        throw new Error(`No token provider registered for platform: ${platform}`);
      }

      this.logger.info(`Refreshing token for platform: ${platform}, type: ${tokenType}`);
      const tokenInfo = await provider(platform, tokenType);

      if (tokenInfo && tokenInfo.token) {
        // Store the new token
        const expiresIn = tokenInfo.expiresAt ? Math.floor((tokenInfo.expiresAt - Date.now()) / 1000) : undefined;

        await this.storeToken(platform, tokenType, tokenInfo.token, expiresIn);
        return tokenInfo.token;
      }

      return null;
    } catch (error) {
      this.logger.error({ message: `Error refreshing token for ${platform}` }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Helper to generate consistent storage keys
   */
  private getStorageKey(platform: string, tokenType: TokenType): string {
    return `token:${platform}:${tokenType}`;
  }
}
