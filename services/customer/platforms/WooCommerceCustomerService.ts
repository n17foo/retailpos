/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { WooCommerceApiClient } from '../../clients/woocommerce/WooCommerceApiClient';

export class WooCommerceCustomerService extends BaseCustomerService {
  private apiClient = WooCommerceApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WooCommerceCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      const storeUrl = (await secretsService.getSecret('WOOCOMMERCE_STORE_URL')) || process.env.WOOCOMMERCE_STORE_URL || '';

      if (!storeUrl) {
        this.logger.warn('Missing WooCommerce store URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize WooCommerce customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) {
      return { customers: [], hasMore: false };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        const limit = options.limit || 10;
        const params: Record<string, string> = { per_page: String(limit) };
        if (options.query) params['search'] = options.query;
        if (options.cursor) params['page'] = options.cursor;

        const data = await this.apiClient.get<any[]>('customers', params);
        const customers: PlatformCustomer[] = (data || []).map((c: any) => this.mapCustomer(c));
        const currentPage = options.cursor ? parseInt(options.cursor, 10) : 1;
        const hasMore = data.length === limit;

        return { customers, hasMore, nextCursor: hasMore ? String(currentPage + 1) : undefined };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching WooCommerce customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;

    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        const data = await this.apiClient.get<any>(`customers/${customerId}`);
        return this.mapCustomer(data);
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching WooCommerce customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    return {
      id: String(c.id),
      platformId: String(c.id),
      platform: ECommercePlatform.WOOCOMMERCE,
      email: c.email || '',
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.billing?.phone,
      tags: [],
      orderCount: c.orders_count,
      totalSpent: c.total_spent ? parseFloat(c.total_spent) : undefined,
      note: c.meta_data?.find((m: any) => m.key === 'note')?.value,
      createdAt: c.date_created ? new Date(c.date_created) : undefined,
      updatedAt: c.date_modified ? new Date(c.date_modified) : undefined,
    };
  }
}
