import { TokenServiceInterface, TokenType, TokenInfo, TokenProviderFunction } from './tokenServiceInterface';
import { LoggerFactory } from '../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Conditionally import MMKV to avoid errors in Expo Go
let MMKV: any = null;
try {
  // Check if we're in Expo Go
  const isExpoGo = typeof global !== 'undefined' && (global as any).__expo !== undefined;
  if (!isExpoGo) {
    MMKV = require('react-native-mmkv').MMKV;
  }
} catch (e) {
  // MMKV import failed (Expo Go or NitroModules not available)
  console.warn('MMKV import failed in TokenService, falling back to AsyncStorage');
}

/**
 * TokenService implementation that uses a combination of storage mechanisms
 * and provider functions to manage platform tokens
 */
export class TokenService implements TokenServiceInterface {
  private static instance: TokenService;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private tokenProviders: Map<string, TokenProviderFunction> = new Map();
  private storage: any = null;
  private tokenRefreshPromises: Map<string, Promise<string | null>> = new Map();

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('TokenService');
    this.initializeStorage();
  }

  /**
   * Initialize storage based on environment
   */
  private initializeStorage(): void {
    try {
      // Use MMKV if available (native platforms and not Expo Go)
      if (Platform.OS !== 'web' && MMKV) {
        this.storage = new MMKV({
          id: 'tokens-storage',
          encryptionKey: 'secure-token-storage-key',
        });
        this.logger.info('MMKV token storage initialized');
      } else {
        this.storage = null; // Will fall back to AsyncStorage
        this.logger.info('Using AsyncStorage for tokens (Expo Go or web platform)');
      }
    } catch (error) {
      this.storage = null; // Fall back to AsyncStorage on error
      this.logger.error(
        { message: 'Error initializing token storage, falling back to AsyncStorage' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
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

      const tokenJson = JSON.stringify(tokenInfo);

      if (this.storage) {
        this.storage.set(key, tokenJson);
      } else {
        await AsyncStorage.setItem(key, tokenJson);
      }

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

      if (this.storage) {
        keys.forEach(key => {
          if (this.storage?.contains(key)) {
            this.storage.delete(key);
          }
        });
      } else {
        const existingKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = existingKeys.filter(key => keys.includes(key));
        await AsyncStorage.multiRemove(keysToRemove);
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

      if (this.storage) {
        if (this.storage.contains(key)) {
          this.storage.delete(key);
        }
      } else {
        await AsyncStorage.removeItem(key);
      }

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
      let tokenJson: string | undefined | null = null;

      if (this.storage) {
        tokenJson = this.storage.getString(key);
      } else {
        tokenJson = await AsyncStorage.getItem(key);
      }

      if (!tokenJson) {
        return null;
      }

      return JSON.parse(tokenJson) as TokenInfo;
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
