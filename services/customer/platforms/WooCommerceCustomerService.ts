/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { WOOCOMMERCE_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';
import { WooCommerceApiClient } from '../../clients/woocommerce/WooCommerceApiClient';

export class WooCommerceCustomerService extends BaseCustomerService {
  private storeUrl = '';
  private apiVersion = WOOCOMMERCE_API_VERSION;
  private apiClient = WooCommerceApiClient.getInstance();

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

      // Configure and initialize the shared WooCommerce client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.storeUrl,
          apiVersion: this.apiVersion,
        });
        await this.apiClient.initialize();
      }
      this.storeUrl = this.apiClient.getBaseUrl();

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
    return this.apiClient['buildHeaders']();
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
