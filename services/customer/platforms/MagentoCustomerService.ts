/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { MAGENTO_API_VERSION } from '../../config/apiVersions';
import secretsService from '../../secrets/SecretsService';

export class MagentoCustomerService extends BaseCustomerService {
  private baseUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('MagentoCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.baseUrl = ((await secretsService.getSecret('MAGENTO_BASE_URL')) || '').replace(/\/+$/, '');
      if (!this.baseUrl) {
        this.logger.warn('Missing Magento base URL');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.MAGENTO);
      if (!ok) {
        this.logger.warn('Failed to initialize Magento token');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.MAGENTO, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
        const limit = options.limit || 10;
        const page = options.cursor ? parseInt(options.cursor, 10) : 1;
        const filter = options.query
          ? `&searchCriteria[filterGroups][0][filters][0][field]=email&searchCriteria[filterGroups][0][filters][0][value]=%25${encodeURIComponent(options.query)}%25&searchCriteria[filterGroups][0][filters][0][conditionType]=like`
          : '';
        const url = `${this.baseUrl}/rest/${MAGENTO_API_VERSION}/customers/search?searchCriteria[pageSize]=${limit}&searchCriteria[currentPage]=${page}${filter}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Magento customer search failed: ${response.status}`);
        const body = await response.json();
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
        const url = `${this.baseUrl}/rest/${MAGENTO_API_VERSION}/customers/${customerId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        return this.mapCustomer(await response.json());
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
