/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

export class SyliusCustomerService extends BaseCustomerService {
  private baseUrl = '';
  private apiClient = SyliusApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SyliusCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.baseUrl = ((await secretsService.getSecret('SYLIUS_BASE_URL')) || '').replace(/\/+$/, '');
      if (!this.baseUrl) {
        this.logger.warn('Missing Sylius base URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl: this.baseUrl });
        await this.apiClient.initialize();
      }
      this.baseUrl = this.apiClient.getBaseUrl();

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Sylius customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return this.apiClient['buildHeaders']();
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
        const limit = options.limit || 10;
        const page = options.cursor ? parseInt(options.cursor, 10) : 1;
        const params = new URLSearchParams({ itemsPerPage: String(limit), page: String(page) });
        if (options.query) params.append('email', options.query);
        const url = `${this.baseUrl}/api/v2/shop/customers?${params}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Sylius customer search failed: ${response.status}`);
        const body = await response.json();
        const items = body['hydra:member'] || body.items || [];
        const customers: PlatformCustomer[] = items.map((c: any) => this.mapCustomer(c));
        const totalItems = body['hydra:totalItems'] || 0;
        const hasMore = page * limit < totalItems;
        return { customers, hasMore, nextCursor: hasMore ? String(page + 1) : undefined };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching Sylius customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;
    try {
      return await withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
        const url = `${this.baseUrl}/api/v2/shop/customers/${customerId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        return this.mapCustomer(await response.json());
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching Sylius customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    const id = c.id || c['@id']?.split('/').pop() || '';
    return {
      id: String(id),
      platformId: String(id),
      platform: ECommercePlatform.SYLIUS,
      email: c.email || '',
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phoneNumber,
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
    };
  }
}
