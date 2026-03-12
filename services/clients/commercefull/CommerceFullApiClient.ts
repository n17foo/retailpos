import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { BaseApiClient, BaseApiClientConfig, AuthStrategy } from '../BaseApiClient';

export interface CommerceFullConfig extends BaseApiClientConfig {
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Shared HTTP client for all CommerceFull platform services.
 * Handles authentication via token-based auth (access + refresh tokens).
 * All services share a single instance to reuse the auth session.
 */
export class CommerceFullApiClient extends BaseApiClient<CommerceFullConfig> {
  private static instance: CommerceFullApiClient;
  private accessToken: string | null = null;

  private constructor() {
    super('CommerceFullApiClient');
  }

  public static getInstance(): CommerceFullApiClient {
    if (!CommerceFullApiClient.instance) {
      CommerceFullApiClient.instance = new CommerceFullApiClient();
    }
    return CommerceFullApiClient.instance;
  }

  protected getAuthStrategy(): AuthStrategy {
    if (this.accessToken) {
      return { type: 'bearer', token: this.accessToken };
    }
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    return `${this.normalizeUrl(this.config.storeUrl || '')}${path}`;
  }

  /**
   * Initialize the client: authenticate and obtain an access token.
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.config.storeUrl) {
        this.logger.warn('Missing CommerceFull storeUrl');
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
        const data = await this.request<{ accessToken?: string; token?: string }>('POST', `${this.config.storeUrl}/business/auth/token`, {
          email: this.config.apiKey,
          password: this.config.apiSecret,
        });
        this.accessToken = data.accessToken || data.token || null;
        this.initialized = !!this.accessToken;
        return this.initialized;
      }

      // Direct token in apiKey field
      if (this.config.apiKey) {
        this.accessToken = this.config.apiKey as string;
        this.initialized = true;
        return true;
      }

      this.logger.warn('No credentials provided for CommerceFull');
      return false;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize CommerceFull API client' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }
}
