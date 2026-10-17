/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Order, TaxQuote } from '../OrderServiceInterface';

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
 * Interface for platform-specific order service implementations.
 * Mirrors OrderServiceInterface but adds the draft lifecycle methods.
 */
export interface PlatformOrderServiceInterface {
  initialize(): Promise<boolean>;
  isInitialized(): boolean;
  getConfigRequirements(): PlatformConfigRequirements;

  /** Create a draft order (platform-calculated tax, not yet paid) */
  createDraftOrder(order: Order): Promise<Order>;
  /** Platform-calculated tax for a basket without creating a lasting order (platforms without drafts) */
  quoteTax(order: Order): Promise<TaxQuote>;
  /** Cancel/delete a draft before payment */
  cancelDraftOrder(platformOrderId: string): Promise<void>;
  /** Mark a draft as paid after payment succeeds */
  completeOrder(platformOrderId: string, paymentMethod: string, transactionId?: string): Promise<Order | null>;

  /** Legacy: create a fully-paid order (used by sync service) */
  createOrder(order: Order): Promise<Order>;
  getOrder(orderId: string): Promise<Order | null>;
  updateOrder(orderId: string, updates: Partial<Order>): Promise<Order | null>;
}
