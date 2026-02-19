import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import { WOOCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/secretsService';

export class WooCommerceCustomerService extends BaseCustomerService {
  private storeUrl = '';
  private apiVersion = WOOCOMMERCE_API_VERSION;

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WooCommerceCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeUrl = (await secretsService.getSecret('WOOCOMMERCE_STORE_URL')) || process.env.WOOCOMMERCE_STORE_URL || '';

      if (!this.storeUrl) {
        this.logger.warn('Missing WooCommerce store URL');
        return false;
      }

      this.storeUrl = this.storeUrl.replace(/\/+$/, '');

      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WOOCOMMERCE);
      if (!tokenInitialized) {
        this.logger.warn('Failed to initialize WooCommerce token provider');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.WOOCOMMERCE, TokenType.ACCESS);
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    };
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) {
      return { customers: [], hasMore: false };
    }

    try {
      return await withTokenRefresh(ECommercePlatform.WOOCOMMERCE, async () => {
        const limit = options.limit || 10;
        const params = new URLSearchParams();
        params.append('per_page', String(limit));

        if (options.query) {
          params.append('search', options.query);
        }

        if (options.cursor) {
          params.append('page', options.cursor);
        }

        const url = `${this.storeUrl}/wp-json/${this.apiVersion}/customers?${params.toString()}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`WooCommerce customer search failed: ${response.status}`);
        }

        const data = await response.json();
        const customers: PlatformCustomer[] = (data || []).map((c: any) => this.mapCustomer(c));

        const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
        const currentPage = options.cursor ? parseInt(options.cursor, 10) : 1;
        const hasMore = currentPage < totalPages;

        return {
          customers,
          hasMore,
          nextCursor: hasMore ? String(currentPage + 1) : undefined,
        };
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
        const url = `${this.storeUrl}/wp-json/${this.apiVersion}/customers/${customerId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) return null;

        const data = await response.json();
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
