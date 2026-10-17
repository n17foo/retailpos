import { CustomerServiceInterface, CustomerSearchOptions, CustomerSearchResult } from '../CustomerServiceInterface';
import { LoggerFactory } from '../../../../../shared/services/logger/LoggerFactory';

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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }
}
