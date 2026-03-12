/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

export class ShopifyCustomerService extends BaseCustomerService {
  private storeUrl = '';
  private apiClient = ShopifyApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeUrl = (await secretsService.getSecret('SHOPIFY_STORE_URL')) || process.env.SHOPIFY_STORE_URL || '';

      if (!this.storeUrl) {
        this.logger.warn('Missing Shopify store URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl: this.storeUrl });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Shopify customer service' },
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
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        const limit = options.limit || 10;
        const params: Record<string, string> = { limit: String(limit) };
        if (options.query) params['query'] = options.query;
        if (options.cursor) params['page_info'] = options.cursor;

        const data = await this.apiClient.get<{ customers: any[] }>('customers/search.json', params);
        const customers: PlatformCustomer[] = (data.customers || []).map((c: any) => this.mapCustomer(c));

        return { customers, hasMore: false };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching Shopify customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;

    try {
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        const data = await this.apiClient.get<{ customer: any }>(`customers/${customerId}.json`);
        return data.customer ? this.mapCustomer(data.customer) : null;
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching Shopify customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    return {
      id: String(c.id),
      platformId: String(c.id),
      platform: ECommercePlatform.SHOPIFY,
      email: c.email || '',
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      tags: c.tags ? c.tags.split(',').map((t: string) => t.trim()) : [],
      orderCount: c.orders_count,
      totalSpent: c.total_spent ? parseFloat(c.total_spent) : undefined,
      currency: c.currency,
      note: c.note,
      createdAt: c.created_at ? new Date(c.created_at) : undefined,
      updatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
    };
  }
}
