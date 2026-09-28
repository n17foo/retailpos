import { TokenService } from './TokenService';
import { TokenServiceInterface, TokenType } from './TokenServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';
import { ECommercePlatform } from '../../utils/platforms';
import { getPlatformCredentials, PlatformCredentials } from '../config/PlatformCredentialsResolver';

/**
 * Factory for managing TokenService instances
 * Provides centralized access to token management functionality
 */
export class TokenServiceFactory {
  private static instance: TokenServiceFactory;
  private service: TokenServiceInterface;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private platformProviders: Map<string, boolean> = new Map();

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('TokenServiceFactory');
    this.service = TokenService.getInstance();
  }

  /**
   * Get the singleton instance of TokenServiceFactory
   */
  public static getInstance(): TokenServiceFactory {
    if (!TokenServiceFactory.instance) {
      TokenServiceFactory.instance = new TokenServiceFactory();
    }
    return TokenServiceFactory.instance;
  }

  /**
   * Get the token service instance
   */
  public getService(): TokenServiceInterface {
    return this.service;
  }

  /**
   * Initialize platform-specific token providers
   * This registers functions that know how to obtain fresh tokens
   * @param platform The platform to initialize
   * @returns True if initialization was successful
   */
  public async initializePlatformProvider(platform: ECommercePlatform): Promise<boolean> {
    if (this.platformProviders.has(platform)) {
      return true;
    }

    try {
      switch (platform) {
        case ECommercePlatform.MAGENTO:
          this.setupMagentoTokenProvider();
          break;
        case ECommercePlatform.SHOPIFY:
          this.registerStaticTokenProvider(
            ECommercePlatform.SHOPIFY,
            credentials => credentials.accessToken || credentials.apiKey,
            'Shopify access token is not configured'
          );
          break;
        case ECommercePlatform.BIGCOMMERCE:
          this.registerStaticTokenProvider(
            ECommercePlatform.BIGCOMMERCE,
            credentials => credentials.accessToken,
            'BigCommerce access token is not configured'
          );
          break;
        case ECommercePlatform.WOOCOMMERCE:
          this.registerStaticTokenProvider(
            ECommercePlatform.WOOCOMMERCE,
            credentials => credentials.apiKey,
            'WooCommerce consumer key is not configured'
          );
          break;
        case ECommercePlatform.SYLIUS:
          this.setupSyliusTokenProvider();
          break;
        case ECommercePlatform.WIX:
          this.registerStaticTokenProvider(ECommercePlatform.WIX, credentials => credentials.apiKey, 'Wix API key is not configured');
          break;
        case ECommercePlatform.PRESTASHOP:
          this.registerStaticTokenProvider(
            ECommercePlatform.PRESTASHOP,
            credentials => credentials.apiKey,
            'PrestaShop API key is not configured'
          );
          break;
        case ECommercePlatform.SQUARESPACE:
          this.registerStaticTokenProvider(
            ECommercePlatform.SQUARESPACE,
            credentials => credentials.apiKey,
            'Squarespace API key is not configured'
          );
          break;
        case ECommercePlatform.COMMERCEFULL:
          this.setupCommercefullTokenProvider();
          break;
        case ECommercePlatform.OFFLINE:
          this.logger.info(`Platform ${platform} does not require token management`);
          return false;
        default:
          this.logger.warn(`No token provider implementation for platform: ${platform}`);
          return false;
      }

      this.platformProviders.set(platform, true);
      this.logger.info(`Token provider initialized for platform: ${platform}`);
      return true;
    } catch (error) {
      this.logger.error(
        { message: `Failed to initialize token provider for ${platform}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Register a provider for platforms whose credential is a long-lived key or
   * token (Shopify Admin API token, BigCommerce/WooCommerce/Wix/PrestaShop/
   * Squarespace keys). These never expire, so the stored credential is
   * returned directly — no fabricated or exchanged tokens.
   */
  private registerStaticTokenProvider(
    platform: ECommercePlatform,
    resolveToken: (credentials: PlatformCredentials) => string | undefined,
    missingMessage: string
  ): void {
    this.service.registerTokenProvider(platform, async () => {
      try {
        const credentials = await getPlatformCredentials(platform);
        const token = credentials ? resolveToken(credentials) : undefined;
        if (!token) {
          throw new Error(missingMessage);
        }
        return { token };
      } catch (error) {
        this.logger.error({ message: `Failed to obtain ${platform} token` }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  /**
   * Setup Magento token provider.
   * Prefers the configured integration access token (non-expiring). If only
   * admin username/password are available (legacy secret or env vars), it
   * exchanges them for an admin token via the Magento token endpoint.
   */
  private setupMagentoTokenProvider(): void {
    this.service.registerTokenProvider(ECommercePlatform.MAGENTO, async (_platform, tokenType) => {
      try {
        const credentials = await getPlatformCredentials(ECommercePlatform.MAGENTO);

        if (credentials?.accessToken) {
          return { token: credentials.accessToken };
        }

        const username = credentials?.username || process.env.MAGENTO_USERNAME;
        const password = credentials?.password || process.env.MAGENTO_PASSWORD;
        const apiUrl = credentials?.apiUrl || credentials?.storeUrl || process.env.MAGENTO_STORE_URL;

        if (!username || !password || !apiUrl) {
          throw new Error('Magento credentials not found in settings, secrets store, or environment variables');
        }

        const { MagentoApiClient } = require('../clients/magento/MagentoApiClient');
        const token = await MagentoApiClient.getInstance().fetchAdminToken(apiUrl, username, password);

        const expiresAt =
          tokenType === TokenType.REFRESH
            ? Date.now() + 24 * 3600 * 1000 // 24 h for refresh
            : Date.now() + 3600 * 1000; // 1 h for access

        return { token, expiresAt };
      } catch (error) {
        this.logger.error({ message: 'Failed to obtain Magento token' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  /**
   * Setup Sylius token provider.
   * Prefers a configured API token, then the SYLIUS_ACCESS_TOKEN env var, and
   * finally exchanges email/password for a JWT at the shop authentication-token
   * endpoint (credentials from the legacy secret or env vars).
   */
  private setupSyliusTokenProvider(): void {
    this.service.registerTokenProvider(ECommercePlatform.SYLIUS, async (_platform, _tokenType) => {
      try {
        const credentials = await getPlatformCredentials(ECommercePlatform.SYLIUS);

        // 1. A configured API token is used as-is
        if (credentials?.apiToken || credentials?.accessToken) {
          return { token: (credentials.apiToken || credentials.accessToken) as string };
        }

        // 2. Pre-stored access token from env (set by fetch-credentials.sh)
        const envToken = process.env.SYLIUS_ACCESS_TOKEN;
        if (envToken) {
          return { token: envToken, expiresAt: Date.now() + 3600 * 1000 };
        }

        // 3. Exchange email/password for a shop JWT
        const email = credentials?.email || process.env.SYLIUS_EMAIL;
        const password = credentials?.password || process.env.SYLIUS_PASSWORD;
        const baseUrl = (credentials?.storeUrl || credentials?.apiUrl || process.env.SYLIUS_API_URL || '').replace(/\/+$/, '');

        if (!email || !password || !baseUrl) {
          throw new Error('Sylius credentials not found in settings, secrets store, or environment variables');
        }

        const response = await fetch(`${baseUrl}/api/v2/shop/authentication-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) throw new Error(`Sylius auth failed: ${response.status}`);
        const data = (await response.json()) as { token?: string };
        if (!data.token) throw new Error('Sylius auth response missing token');
        return { token: data.token, expiresAt: Date.now() + 3600 * 1000 };
      } catch (error) {
        this.logger.error({ message: 'Failed to obtain Sylius token' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  /**
   * Setup Commercefull token provider.
   * Exchanges the configured apiKey/apiSecret for a bearer token at
   * POST {storeUrl}/business/auth/token. A lone apiKey is treated as a
   * pre-issued static token.
   */
  private setupCommercefullTokenProvider(): void {
    this.service.registerTokenProvider(ECommercePlatform.COMMERCEFULL, async () => {
      try {
        const credentials = await getPlatformCredentials(ECommercePlatform.COMMERCEFULL);

        if (credentials?.apiKey && credentials?.apiSecret && credentials?.storeUrl) {
          const { CommercefullApiClient } = require('../clients/commercefull/CommercefullApiClient');
          const { token, expiresIn } = await CommercefullApiClient.getInstance().fetchAccessToken(
            credentials.storeUrl,
            credentials.apiKey,
            credentials.apiSecret
          );
          return { token, expiresAt: Date.now() + (expiresIn ?? 3600) * 1000 };
        }

        if (credentials?.apiKey) {
          return { token: credentials.apiKey };
        }

        throw new Error('Commercefull credentials are not configured');
      } catch (error) {
        this.logger.error({ message: 'Failed to obtain Commercefull token' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }
}
