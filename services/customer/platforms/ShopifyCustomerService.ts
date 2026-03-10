/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SHOPIFY_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

export class ShopifyCustomerService extends BaseCustomerService {
  private storeUrl = '';
  private apiVersion = SHOPIFY_API_VERSION;
  private apiClient = ShopifyApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.storeUrl = (await secretsService.getSecret('SHOPIFY_STORE_URL')) || process.env.SHOPIFY_STORE_URL || '';
      this.apiVersion = (await secretsService.getSecret('SHOPIFY_API_VERSION')) || SHOPIFY_API_VERSION;

      if (!this.storeUrl) {
        this.logger.warn('Missing Shopify store URL');
        return false;
      }

      // Configure and initialize the shared Shopify client
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
        { message: 'Failed to initialize Shopify customer service' },
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
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        const limit = options.limit || 10;
        const params = new URLSearchParams();
        params.append('limit', String(limit));

        if (options.query) {
          // Shopify REST API uses query parameter for customer search
          params.append('query', options.query);
        }

        if (options.cursor) {
          params.append('page_info', options.cursor);
        }

        const url = `${this.storeUrl}/admin/api/${this.apiVersion}/customers/search.json?${params.toString()}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`Shopify customer search failed: ${response.status}`);
        }

        const data = await response.json();
        const customers: PlatformCustomer[] = (data.customers || []).map((c: any) => this.mapCustomer(c));

        // Parse Link header for pagination
        const linkHeader = response.headers.get('Link') || '';
        const nextCursor = this.parseNextCursor(linkHeader);

        return {
          customers,
          hasMore: !!nextCursor,
          nextCursor,
        };
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
        const url = `${this.storeUrl}/admin/api/${this.apiVersion}/customers/${customerId}.json`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) return null;

        const data = await response.json();
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

  private parseNextCursor(linkHeader: string): string | undefined {
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    return nextMatch ? nextMatch[1] : undefined;
  }
}
