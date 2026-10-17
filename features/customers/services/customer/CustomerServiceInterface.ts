import { ECommercePlatform } from '../../../../shared/utils/platforms';

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
 * The POS reads customer data from the platform — it never creates or modifies customers.
 * Only `searchCustomers` is used in the current E2E flow (attach email to basket).
 */
export interface CustomerServiceInterface {
  initialize(): Promise<boolean>;
  isInitialized(): boolean;
  searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult>;
}
