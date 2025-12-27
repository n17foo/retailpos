import { TokenServiceFactory } from './tokenServiceFactory';
import { ECommercePlatform } from '../../utils/platforms';
import { LoggerFactory } from '../logger';

/**
 * Token initialization service
 * Provides functions to initialize token providers for all platforms
 */
export class TokenInitializer {
  private static instance: TokenInitializer;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;
  private initializedPlatforms: Set<ECommercePlatform> = new Set();

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('TokenInitializer');
  }

  /**
   * Get the singleton instance of TokenInitializer
   */
  public static getInstance(): TokenInitializer {
    if (!TokenInitializer.instance) {
      TokenInitializer.instance = new TokenInitializer();
    }
    return TokenInitializer.instance;
  }

  /**
   * Initialize token providers for all supported platforms
   * @returns A promise that resolves to true if all initializations were successful
   */
  public async initializeAllPlatformTokens(): Promise<boolean> {
    try {
      this.logger.info('Initializing token providers for all platforms');

      const tokenServiceFactory = TokenServiceFactory.getInstance();
      const platforms = Object.values(ECommercePlatform);

      const results = await Promise.all(
        platforms.map(async platform => {
          try {
            const success = await this.initializePlatformToken(platform);
            return { platform, success };
          } catch (error) {
            this.logger.error(
              { message: `Error initializing token for platform: ${platform}` },
              error instanceof Error ? error : new Error(String(error))
            );
            return { platform, success: false };
          }
        })
      );

      // Log results
      const succeeded = results.filter(r => r.success).map(r => r.platform);
      const failed = results.filter(r => !r.success).map(r => r.platform);

      if (succeeded.length > 0) {
        this.logger.info(`Successfully initialized tokens for platforms: ${succeeded.join(', ')}`);
      }

      if (failed.length > 0) {
        this.logger.warn(`Failed to initialize tokens for platforms: ${failed.join(', ')}`);
      }

      return failed.length === 0;
    } catch (error) {
      this.logger.error({ message: 'Error initializing all platform tokens' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Initialize token provider for a specific platform
   * @param platform The platform to initialize
   * @returns A promise that resolves to true if initialization was successful
   */
  public async initializePlatformToken(platform: ECommercePlatform): Promise<boolean> {
    if (this.initializedPlatforms.has(platform)) {
      this.logger.info(`Token provider for ${platform} already initialized`);
      return true;
    }

    try {
      const tokenServiceFactory = TokenServiceFactory.getInstance();
      const success = await tokenServiceFactory.initializePlatformProvider(platform);

      if (success) {
        this.initializedPlatforms.add(platform);
        this.logger.info(`Token provider for ${platform} initialized successfully`);
      } else {
        this.logger.warn(`Failed to initialize token provider for ${platform}`);
      }

      return success;
    } catch (error) {
      this.logger.error(
        { message: `Error initializing token provider for ${platform}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Check if a platform token provider has been initialized
   * @param platform The platform to check
   * @returns True if the token provider has been initialized
   */
  public isPlatformInitialized(platform: ECommercePlatform): boolean {
    return this.initializedPlatforms.has(platform);
  }
}
