import { RefundData, RefundResult, RefundRecord } from '../RefundServiceInterface';

/**
 * Parsed platform API credentials retrieved from the secrets store
 */
export interface PlatformCredentials {
  apiUrl: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  storeUrl?: string;
  [key: string]: string | undefined;
}

/**
 * Minimal HTTP client returned by createXApiClient methods in refund services
 */
export interface RefundApiClient {
  post(endpoint: string, data: unknown): Promise<{ data: Record<string, unknown> }>;
}

/**
 * Interface for platform-specific refund services
 * Each e-commerce platform implementation should implement this interface
 */
export interface PlatformRefundServiceInterface {
  /**
   * Initialize the refund service for a specific platform
   * @returns Promise resolving to true if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   * @returns Boolean indicating if the service is ready
   */
  isInitialized(): boolean;

  /**
   * Process a refund for an order on this specific platform
   * @param orderId The platform order ID to refund
   * @param refundData Details about the refund
   * @returns Promise resolving to the refund result
   */
  processRefund(orderId: string, refundData: RefundData): Promise<RefundResult>;

  /**
   * Get refund history for an order on this platform
   * @param orderId The order ID to get refund history for
   * @returns Promise resolving to list of refunds for the order
   */
  getRefundHistory(orderId: string): Promise<RefundRecord[]>;
}
