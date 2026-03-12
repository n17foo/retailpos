/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

export class MagentoCustomerService extends BaseCustomerService {
  private apiClient = MagentoApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('MagentoCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      const baseUrl = ((await secretsService.getSecret('MAGENTO_BASE_URL')) || '').replace(/\/+$/, '');
      if (!baseUrl) {
        this.logger.warn('Missing Magento base URL');
        return false;
      }

      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({ storeUrl: baseUrl });
        await this.apiClient.initialize();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Magento customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
        const limit = options.limit || 10;
        const page = options.cursor ? parseInt(options.cursor, 10) : 1;
        const params: Record<string, string> = {
          'searchCriteria[pageSize]': String(limit),
          'searchCriteria[currentPage]': String(page),
        };
        if (options.query) {
          params['searchCriteria[filterGroups][0][filters][0][field]'] = 'email';
          params['searchCriteria[filterGroups][0][filters][0][value]'] = `%${options.query}%`;
          params['searchCriteria[filterGroups][0][filters][0][conditionType]'] = 'like';
        }
        const body = await this.apiClient.get<{ items: any[]; total_count: number }>('customers/search', params);
        const customers: PlatformCustomer[] = (body.items || []).map((c: any) => this.mapCustomer(c));
        const totalPages = Math.ceil((body.total_count || 0) / limit);
        return { customers, hasMore: page < totalPages, nextCursor: page < totalPages ? String(page + 1) : undefined };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching Magento customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;
    try {
      return await withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
        const data = await this.apiClient.get<any>(`customers/${customerId}`);
        return this.mapCustomer(data);
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching Magento customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    return {
      id: String(c.id),
      platformId: String(c.id),
      platform: ECommercePlatform.MAGENTO,
      email: c.email || '',
      firstName: c.firstname,
      lastName: c.lastname,
      phone: c.addresses?.[0]?.telephone,
      createdAt: c.created_at ? new Date(c.created_at) : undefined,
      updatedAt: c.updated_at ? new Date(c.updated_at) : undefined,
    };
  }
}
