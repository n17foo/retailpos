import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { BaseApiClient, BaseApiClientConfig, AuthStrategy } from '../BaseApiClient';

export interface CommercefullConfig extends BaseApiClientConfig {
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Shared HTTP client for all Commercefull platform services.
 * Handles authentication via token-based auth (access + refresh tokens).
 * All services share a single instance to reuse the auth session.
 */
export class CommercefullApiClient extends BaseApiClient<CommercefullConfig> {
  private static instance: CommercefullApiClient;
  private accessToken: string | null = null;

  private constructor() {
    super('CommercefullApiClient');
  }

  public static getInstance(): CommercefullApiClient {
    if (!CommercefullApiClient.instance) {
      CommercefullApiClient.instance = new CommercefullApiClient();
    }
    return CommercefullApiClient.instance;
  }

  protected async getAuthStrategy(): Promise<AuthStrategy> {
    // Resolve the current token on every request so refreshed tokens
    // propagate without re-initialising the client.
    const token = (await getPlatformToken(ECommercePlatform.COMMERCEFULL, TokenType.ACCESS)) || this.accessToken;
    if (token) {
      this.accessToken = token;
      return { type: 'bearer', token };
    }
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    return `${this.normalizeUrl(this.config.storeUrl || '')}${path}`;
  }

  /**
   * Exchange apiKey/apiSecret for a bearer token at
   * POST {storeUrl}/business/auth/token.
   *
   * Uses a raw fetch rather than `request()` — the token endpoint is
   * unauthenticated and must not re-enter `getAuthStrategy()`.
   */
  public async fetchAccessToken(storeUrl: string, apiKey: string, apiSecret: string): Promise<{ token: string; expiresIn?: number }> {
    const url = `${this.normalizeUrl(storeUrl)}/business/auth/token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: apiKey, password: apiSecret }),
    });
    if (!response.ok) {
      throw new Error(`Commercefull auth failed: ${response.status}`);
    }
    const data = (await response.json()) as {
      accessToken?: string;
      token?: string;
      expiresIn?: number;
      expires_in?: number;
    };
    const token = data.accessToken || data.token;
    if (!token) {
      throw new Error('Commercefull auth response missing token');
    }
    return { token, expiresIn: data.expiresIn ?? data.expires_in };
  }

  /**
   * Initialize the client: authenticate and obtain an access token.
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn('Missing Commercefull storeUrl');
        return false;
      }

      this.config.storeUrl = this.normalizeUrl(this.config.storeUrl);

      // Try token service first
      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.COMMERCEFULL);
      if (tokenInitialized) {
        const token = await getPlatformToken(ECommercePlatform.COMMERCEFULL, TokenType.ACCESS);
        if (token) {
          this.accessToken = token;
          this.initialized = true;
          return true;
        }
      }

      // Fallback: authenticate with apiKey/apiSecret
      if (this.config.apiKey && this.config.apiSecret) {
        const { token } = await this.fetchAccessToken(this.config.storeUrl, this.config.apiKey, this.config.apiSecret);
        this.accessToken = token;
        this.initialized = true;
        return true;
      }

      // Direct token in apiKey field
      if (this.config.apiKey) {
        this.accessToken = this.config.apiKey as string;
        this.initialized = true;
        return true;
      }

      this.logger.warn('No credentials provided for Commercefull');
      return false;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Commercefull API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }
}
