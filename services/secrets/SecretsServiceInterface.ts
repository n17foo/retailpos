/**
 * Interface for the secrets service
 * Provides methods for securely storing and retrieving sensitive information
 */
export interface SecretsServiceInterface {
  /**
   * Stores a secret value securely
   * @param key The identifier for the secret
   * @param value The secret value to store
   * @returns A promise that resolves to true if successful
   */
  storeSecret(key: string, value: string): Promise<boolean>;

  /**
   * Stores multiple secrets at once
   * @param secrets Object containing key-value pairs of secrets to store
   * @returns A promise that resolves when all secrets are stored
   */
  storeSecrets(secrets: Record<string, string>): Promise<void>;

  /**
   * Retrieves a secret value
   * @param key The identifier for the secret to retrieve
   * @returns The secret value, or null if not found or error occurred
   */
  getSecret(key: string): Promise<string | null>;

  /**
   * Deletes a secret value
   * @param key The identifier for the secret to delete
   * @returns A promise that resolves to true if successful
   */
  deleteSecret(key: string): Promise<boolean>;

  /**
   * Checks if a secret exists
   * @param key The identifier for the secret to check
   * @returns A promise that resolves to true if the secret exists
   */
  hasSecret(key: string): Promise<boolean>;
}

/**
 * Common enum for secret keys used throughout the application
 */
export enum SecretKeys {
  // Payment provider secrets
  WORLDPAY_MERCHANT_ID = 'WORLDPAY_MERCHANT_ID',
  WORLDPAY_SITE_REFERENCE = 'WORLDPAY_SITE_REFERENCE',
  WORLDPAY_INSTALLATION_ID = 'WORLDPAY_INSTALLATION_ID',
  STRIPE_PUBLISHABLE_KEY = 'STRIPE_PUBLISHABLE_KEY',
  SQUARE_APPLICATION_ID = 'SQUARE_APPLICATION_ID',

  // E-commerce platform secrets
  // Shopify
  SHOPIFY_API_KEY = 'SHOPIFY_API_KEY',
  SHOPIFY_API_SECRET = 'SHOPIFY_API_SECRET',
  SHOPIFY_STORE_URL = 'SHOPIFY_STORE_URL',

  // WooCommerce
  WOOCOMMERCE_CONSUMER_KEY = 'WOOCOMMERCE_CONSUMER_KEY',
  WOOCOMMERCE_CONSUMER_SECRET = 'WOOCOMMERCE_CONSUMER_SECRET',
  WOOCOMMERCE_STORE_URL = 'WOOCOMMERCE_STORE_URL',

  // Magento
  MAGENTO_ACCESS_TOKEN = 'MAGENTO_ACCESS_TOKEN',
  MAGENTO_STORE_URL = 'MAGENTO_STORE_URL',
  MAGENTO_API_VERSION = 'MAGENTO_API_VERSION',

  // BigCommerce
  BIGCOMMERCE_CLIENT_ID = 'BIGCOMMERCE_CLIENT_ID',
  BIGCOMMERCE_ACCESS_TOKEN = 'BIGCOMMERCE_ACCESS_TOKEN',
  BIGCOMMERCE_STORE_HASH = 'BIGCOMMERCE_STORE_HASH',

  // Sylius
  SYLIUS_API_TOKEN = 'SYLIUS_API_TOKEN',
  SYLIUS_STORE_URL = 'SYLIUS_STORE_URL',
  SYLIUS_API_VERSION = 'SYLIUS_API_VERSION',

  // Wix
  WIX_API_KEY = 'WIX_API_KEY',
  WIX_ACCESS_TOKEN = 'WIX_ACCESS_TOKEN',
  WIX_STORE_URL = 'WIX_STORE_URL',
}
