import { Platform } from 'react-native';
import { SecretsServiceInterface } from './SecretsServiceInterface';
import { KeychainSecretsService } from './KeychainSecretsService';
import { ElectronSecretsService } from './ElectronSecretsService';
import { BrowserSecretsService } from './BrowserSecretsService';
import { MemorySecretsService } from './mock/MemorySecretsService';
import { isElectron } from '../../utils/electron';
import { USE_MOCK_SECRETS } from '@env';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Factory for creating and managing secrets service instances
 * Follows the same pattern as other services in the application
 */
export class SecretsServiceFactory {
  private static instance: SecretsServiceFactory;
  private currentService: SecretsServiceInterface;

  private constructor() {
    const logger = LoggerFactory.getInstance().createLogger('SecretsServiceFactory');
    logger.debug('USE_MOCK_SECRETS', USE_MOCK_SECRETS);
    // Initialize the appropriate service based on the explicit mock flag and runtime.
    if (USE_MOCK_SECRETS === 'true') {
      // Use mock service for Expo Go or testing
      this.currentService = MemorySecretsService.getInstance();
      logger.debug('Using MemorySecretsService (mock)');
    } else if (isElectron()) {
      this.currentService = ElectronSecretsService.getInstance();
      logger.debug('Using ElectronSecretsService');
    } else if (Platform.OS === 'ios' || Platform.OS === 'android') {
      this.currentService = KeychainSecretsService.getInstance();
      logger.debug('Using KeychainSecretsService');
    } else {
      this.currentService = BrowserSecretsService.getInstance();
      logger.debug('Using BrowserSecretsService');
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
