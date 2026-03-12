/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';
import { PrestaShopApiClient } from '../../clients/prestashop/PrestaShopApiClient';

export class PrestaShopCustomerService extends BaseCustomerService {
  private apiClient = PrestaShopApiClient.getInstance();

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      const baseUrl = ((await secretsService.getSecret('PRESTASHOP_BASE_URL')) || '').replace(/\/+$/, '');
      if (!baseUrl) {
        this.logger.warn('Missing PrestaShop base URL');
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
        { message: 'Failed to initialize PrestaShop customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        const limit = options.limit || 10;
        const offset = options.cursor ? parseInt(options.cursor, 10) : 0;
        let path = `customers?display=full&limit=${offset},${limit}&output_format=JSON`;
        if (options.query) path += `&filter[email]=[${encodeURIComponent(options.query)}]%25`;
        const body = await this.apiClient.get<any>(path);
        const items = body.customers || [];
        const customers: PlatformCustomer[] = items.map((c: any) => this.mapCustomer(c));
        return { customers, hasMore: items.length === limit, nextCursor: items.length === limit ? String(offset + limit) : undefined };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching PrestaShop customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        const body = await this.apiClient.get<any>(`customers/${customerId}?output_format=JSON`);
        return this.mapCustomer(body.customer || body);
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching PrestaShop customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    return {
      id: String(c.id),
      platformId: String(c.id),
      platform: ECommercePlatform.PRESTASHOP,
      email: c.email || '',
      firstName: c.firstname,
      lastName: c.lastname,
      createdAt: c.date_add ? new Date(c.date_add) : undefined,
      updatedAt: c.date_upd ? new Date(c.date_upd) : undefined,
    };
  }
}
