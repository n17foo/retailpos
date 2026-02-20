/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { BIGCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class BigCommerceCustomerService extends BaseCustomerService {
  private storeHash = '';
  private apiVersion = BIGCOMMERCE_API_VERSION;

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeHash = (await secretsService.getSecret('BIGCOMMERCE_STORE_HASH')) || '';
      if (!this.storeHash) {
        this.logger.warn('Missing BigCommerce store hash');
        return false;
      }
      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.BIGCOMMERCE);
      if (!tokenInitialized) {
        this.logger.warn('Failed to initialize BigCommerce token provider');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.BIGCOMMERCE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' };
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
        const limit = options.limit || 10;
        const params = new URLSearchParams({ limit: String(limit) });
        if (options.query) params.append('name:like', options.query);
        if (options.cursor) params.append('page', options.cursor);

        const url = `https://api.bigcommerce.com/stores/${this.storeHash}/${this.apiVersion}/customers?${params}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`BigCommerce customer search failed: ${response.status}`);

        const body = await response.json();
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
        const url = `https://api.bigcommerce.com/stores/${this.storeHash}/${this.apiVersion}/customers?id:in=${customerId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        const body = await response.json();
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
