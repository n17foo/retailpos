import { CustomerServiceInterface, CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Base abstract class for platform-specific customer service implementations.
 */
export abstract class BaseCustomerService implements CustomerServiceInterface {
  protected initialized = false;
  protected logger = LoggerFactory.getInstance().createLogger('BaseCustomerService');

  abstract initialize(): Promise<boolean>;

  isInitialized(): boolean {
    return this.initialized;
  }

  abstract searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult>;

  abstract getCustomer(customerId: string): Promise<PlatformCustomer | null>;

  /**
   * Utility: build auth headers for platform API calls.
   * Subclasses override to provide platform-specific headers.
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }
}
