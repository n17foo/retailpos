import { SecretsServiceInterface } from './SecretsServiceInterface';
import { KeychainSecretsService } from './KeychainSecretsService';
import { MemorySecretsService } from './mock/MemorySecretsService';
import { USE_MOCK_SECRETS } from '@env';
import { LoggerFactory } from '../logger/loggerFactory';

/**
 * Factory for creating and managing secrets service instances
 * Follows the same pattern as other services in the application
 */
export class SecretsServiceFactory {
  private static instance: SecretsServiceFactory;
  private currentService: SecretsServiceInterface;

  private constructor() {
    const logger = LoggerFactory.getInstance().createLogger('SecretsServiceFactory');
    console.log('USE_MOCK_SECRETS', USE_MOCK_SECRETS);
    // Initialize the appropriate service based on the USE_MOCK_SECRETS flag
    if (USE_MOCK_SECRETS) {
      // Use mock service for Expo Go or testing
      this.currentService = MemorySecretsService.getInstance();
      logger.info('Using MemorySecretsService (mock)');
    } else {
      // Use real keychain service for production
      this.currentService = KeychainSecretsService.getInstance();
      logger.info('Using KeychainSecretsService');
    }
  }

  /**
   * Gets the singleton instance of SecretsServiceFactory
   */
  public static getInstance(): SecretsServiceFactory {
    if (!SecretsServiceFactory.instance) {
      SecretsServiceFactory.instance = new SecretsServiceFactory();
    }
    return SecretsServiceFactory.instance;
  }

  /**
   * Get the current secrets service implementation
   */
  public getService(): SecretsServiceInterface {
    return this.currentService;
  }
}

// Re-export SecretKeys for convenience
export { SecretKeys } from './SecretsServiceInterface';

// Create and export the factory instance
export const secretsServiceFactory = SecretsServiceFactory.getInstance();

// Export the current service instance for backward compatibility
export default secretsServiceFactory.getService();
