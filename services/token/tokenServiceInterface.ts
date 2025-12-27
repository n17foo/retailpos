/**
 * Interface for the token service
 * Provides methods for storing and retrieving platform-specific tokens/JWTs
 */
export interface TokenServiceInterface {
  /**
   * Store a token for a specific platform
   * @param platform The platform identifier
   * @param tokenType The type of token (access, refresh, etc.)
   * @param token The token value
   * @param expiresIn Optional expiration time in seconds
   * @returns A promise that resolves to true if storage was successful
   */
  storeToken(platform: string, tokenType: TokenType, token: string, expiresIn?: number): Promise<boolean>;

  /**
   * Retrieve a token for a specific platform
   * @param platform The platform identifier
   * @param tokenType The type of token to retrieve
   * @param forceRefresh If true, will force token refresh even if not expired
   * @returns The token or null if not available
   */
  getToken(platform: string, tokenType: TokenType, forceRefresh?: boolean): Promise<string | null>;

  /**
   * Check if a token exists and is valid
   * @param platform The platform identifier
   * @param tokenType The type of token to check
   * @returns True if token exists and is not expired
   */
  hasValidToken(platform: string, tokenType: TokenType): Promise<boolean>;

  /**
   * Clear all tokens for a specific platform
   * @param platform The platform identifier
   * @returns A promise that resolves when tokens are cleared
   */
  clearPlatformTokens(platform: string): Promise<void>;

  /**
   * Clear a specific token type for a platform
   * @param platform The platform identifier
   * @param tokenType The type of token to clear
   * @returns A promise that resolves when token is cleared
   */
  clearToken(platform: string, tokenType: TokenType): Promise<void>;

  /**
   * Register a token provider for a platform
   * This allows the service to fetch new tokens when needed
   * @param platform The platform identifier
   * @param provider Function that returns a promise resolving to token info
   */
  registerTokenProvider(platform: string, provider: TokenProviderFunction): void;
}

/**
 * Types of tokens that can be managed
 */
export enum TokenType {
  ACCESS = 'access_token',
  REFRESH = 'refresh_token',
  ID = 'id_token',
  API_KEY = 'api_key',
  SESSION = 'session_token',
}

/**
 * Structure of token information
 */
export interface TokenInfo {
  token: string;
  expiresAt?: number; // Unix timestamp in milliseconds
}

/**
 * Function signature for token providers
 */
export type TokenProviderFunction = (platform: string, tokenType: TokenType) => Promise<TokenInfo>;
