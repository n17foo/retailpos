import { ECommercePlatform } from '../../utils/platforms';

/**
 * Represents a customer from the e-commerce platform.
 * The POS consumes customers from the platform — it does not create them locally.
 */
export interface PlatformCustomer {
  id: string;
  platformId: string;
  platform: ECommercePlatform;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags?: string[];
  orderCount?: number;
  totalSpent?: number;
  currency?: string;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Options for searching customers
 */
export interface CustomerSearchOptions {
  query: string;
  limit?: number;
  cursor?: string;
}

/**
 * Results from a customer search
 */
export interface CustomerSearchResult {
  customers: PlatformCustomer[];
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Interface for customer-related operations.
 * Implementations call the e-commerce platform's customer API.
 */
export interface CustomerServiceInterface {
  /**
   * Initialize the customer service
   */
  initialize(): Promise<boolean>;

  /**
   * Whether the service is ready
   */
  isInitialized(): boolean;

  /**
   * Search customers by name, email, or phone
   */
  searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult>;

  /**
   * Get a single customer by platform ID
   */
  getCustomer(customerId: string): Promise<PlatformCustomer | null>;
}
