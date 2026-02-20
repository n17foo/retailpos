import { SecretsServiceInterface } from '../SecretsServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Mock implementation of SecretsServiceInterface using in-memory storage
 * This is used for development in Expo Go where native modules aren't available
 */
export class MemorySecretsService implements SecretsServiceInterface {
  private static instance: MemorySecretsService;
  private secretsMap: Map<string, string> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('MemorySecretsService');

  private constructor() {
    this.logger.info('Mock secrets service initialized');
    this.addDefaultMockSecrets();
  }

  /**
   * Gets the singleton instance of MemorySecretsService
   */
  public static getInstance(): MemorySecretsService {
    if (!MemorySecretsService.instance) {
      MemorySecretsService.instance = new MemorySecretsService();
    }
    return MemorySecretsService.instance;
  }

  /**
   * Stores a secret value in memory (not secure, only for development)
   * @param key The identifier for the secret
   * @param value The secret value to store
   * @returns A promise that resolves to true if successful
   */
  public async storeSecret(key: string, value: string): Promise<boolean> {
    try {
      this.logger.debug(`Storing secret for key: ${key}`);
      this.secretsMap.set(key, value);
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error storing secret' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Stores multiple secrets at once
   * @param secrets Object containing key-value pairs of secrets to store
   * @returns A promise that resolves when all secrets are stored
   */
  public async storeSecrets(secrets: Record<string, string>): Promise<void> {
    try {
      this.logger.debug(`Storing ${Object.keys(secrets).length} secrets in batch`);

      const promises = Object.entries(secrets).map(([key, value]) => this.storeSecret(key, value));

      await Promise.all(promises);
    } catch (error) {
      this.logger.error({ message: 'Error storing secrets batch' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Retrieves a secret value from memory
   * @param key The identifier for the secret to retrieve
   * @returns The secret value, or null if not found or error occurred
   */
  public async getSecret(key: string): Promise<string | null> {
    try {
      this.logger.debug(`Retrieving secret for key: ${key}`);
      const value = this.secretsMap.get(key);
      return value || null;
    } catch (error) {
      this.logger.error({ message: 'Error retrieving secret' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Deletes a secret from memory
   * @param key The identifier for the secret to delete
   * @returns A promise that resolves to true if successful
   */
  public async deleteSecret(key: string): Promise<boolean> {
    try {
      this.logger.debug(`Deleting secret for key: ${key}`);
      this.secretsMap.delete(key);
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error deleting secret' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Checks if a secret exists in memory
   * @param key The identifier for the secret to check
   * @returns A promise that resolves to true if the secret exists
   */
  public async hasSecret(key: string): Promise<boolean> {
    try {
      this.logger.debug(`Checking if secret exists for key: ${key}`);
      return this.secretsMap.has(key);
    } catch (error) {
      this.logger.error({ message: 'Error checking if secret exists' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Adds some default mock secrets for testing
   */
  private async addDefaultMockSecrets(): Promise<void> {
    // Add default mock secrets for payment services
    await this.storeSecret('WORLDPAY_MERCHANT_ID', 'mock-merchant-123');
    await this.storeSecret('WORLDPAY_SITE_REFERENCE', 'mock-site-ref-456');
    await this.storeSecret('WORLDPAY_INSTALLATION_ID', 'mock-install-789');
    await this.storeSecret('STRIPE_PUBLISHABLE_KEY', 'pk_test_mock123456789');
    await this.storeSecret('SQUARE_APPLICATION_ID', 'sandbox-sq0idb-mock-123456');

    // Add default mock secrets for Shopify
    await this.storeSecret('SHOPIFY_API_KEY', 'mock-shopify-api-key');
    await this.storeSecret('SHOPIFY_API_SECRET', 'mock-shopify-api-secret');
    await this.storeSecret('SHOPIFY_STORE_URL', 'https://mock-store.myshopify.com');

    // Add default mock secrets for WooCommerce
    await this.storeSecret('WOOCOMMERCE_CONSUMER_KEY', 'mock-woo-consumer-key');
    await this.storeSecret('WOOCOMMERCE_CONSUMER_SECRET', 'mock-woo-consumer-secret');
    await this.storeSecret('WOOCOMMERCE_STORE_URL', 'https://mock-woo-store.com');

    // Add default mock secrets for Magento
    await this.storeSecret('MAGENTO_ACCESS_TOKEN', 'mock-magento-token');
    await this.storeSecret('MAGENTO_STORE_URL', 'https://mock-magento-store.com');
    await this.storeSecret('MAGENTO_API_VERSION', 'V1');

    // Add default mock secrets for BigCommerce
    await this.storeSecret('BIGCOMMERCE_CLIENT_ID', 'mock-bigcommerce-client-id');
    await this.storeSecret('BIGCOMMERCE_ACCESS_TOKEN', 'mock-bigcommerce-token');
    await this.storeSecret('BIGCOMMERCE_STORE_HASH', 'store-hash-123');

    // Add default mock secrets for Sylius
    await this.storeSecret('SYLIUS_API_TOKEN', 'mock-sylius-token');
    await this.storeSecret('SYLIUS_STORE_URL', 'https://mock-sylius-store.com');
    await this.storeSecret('SYLIUS_API_VERSION', 'v1');

    // Add default mock secrets for Wix
    await this.storeSecret('WIX_API_KEY', 'mock-wix-api-key');
    await this.storeSecret('WIX_ACCESS_TOKEN', 'mock-wix-token');
    await this.storeSecret('WIX_STORE_URL', 'https://mock-wix-store.com');

    this.logger.info('Default mock secrets added');
  }
}
