/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order } from '../OrderServiceInterface';
import { RefundData, RefundResult } from '../../refund/RefundServiceInterface';

/**
 * Configuration requirements for platform order services
 */
export interface PlatformConfigRequirements {
  required: string[];
  optional: string[];
  description: string;
}

/**
 * Configuration for platform-specific order services
 * Different platforms will use different properties from this object
 */
export interface PlatformOrderConfig {
  // Common properties
  storeUrl?: string;
  apiVersion?: string;

  // Authentication properties
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  consumerKey?: string;
  consumerSecret?: string;
  username?: string;
  password?: string;

  // Other configuration options
  webhookUrl?: string;
  defaultLanguage?: string;
  cacheTimeout?: number;

  // Mock configuration options
  mockDelay?: number;
  mockFailure?: boolean;

  // Any other platform-specific options can be added via indexing
  [key: string]: any;
}

/**
 * Interface for platform-specific order service implementations
 */
export interface PlatformOrderServiceInterface {
  /**
   * Initialize the platform order service with required configuration
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean;

  /**
   * Get configuration requirements for this platform
   */
  getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Create a new order in the e-commerce platform
   * @param order Order details to be created
   * @returns Promise resolving to the created order with platform-specific IDs
   */
  createOrder(order: Order): Promise<Order>;

  /**
   * Get an existing order by ID
   * @param orderId The ID of the order to retrieve
   * @returns Promise resolving to the order if found
   */
  getOrder(orderId: string): Promise<Order | null>;

  /**
   * Update an existing order
   * @param orderId The ID of the order to update
   * @param updates The order properties to update
   * @returns Promise resolving to the updated order
   */
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null>;

  // Refund functionality moved to dedicated refund service
}
