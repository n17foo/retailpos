/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';

export class BigCommerceCustomerService extends BaseCustomerService {
  private apiClient = BigCommerceApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      const storeHash = (await secretsService.getSecret('BIGCOMMERCE_STORE_HASH')) || '';
      if (!storeHash) {
        this.logger.warn('Missing BigCommerce store hash');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeHash });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize BigCommerce customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        const limit = options.limit || 10;
        const params: Record<string, string> = { limit: String(limit) };
        if (options.query) params['name:like'] = options.query;
        if (options.cursor) params['page'] = options.cursor;

        const body = await this.apiClient.get<{ data: any[]; meta: any }>('customers', params);
        const customers: PlatformCustomer[] = (body.data || []).map((c: any) => this.mapCustomer(c));
        const hasMore = !!(body.meta?.pagination?.total_pages && body.meta.pagination.current_page < body.meta.pagination.total_pages);
        return { customers, hasMore, nextCursor: hasMore ? String((body.meta?.pagination?.current_page || 1) + 1) : undefined };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching BigCommerce customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        const body = await this.apiClient.get<{ data: any[] }>('customers', { 'id:in': customerId });
        if (!body.data?.length) return null;
        return this.mapCustomer(body.data[0]);
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching BigCommerce customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    return {
      id: String(c.id),
      platformId: String(c.id),
      platform: ECommercePlatform.BIGCOMMERCE,
      email: c.email || '',
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      orderCount: c.orders_count,
      totalSpent: c.total_spent ? parseFloat(c.total_spent) : undefined,
      createdAt: c.date_created ? new Date(c.date_created) : undefined,
      updatedAt: c.date_modified ? new Date(c.date_modified) : undefined,
    };
  }
}
