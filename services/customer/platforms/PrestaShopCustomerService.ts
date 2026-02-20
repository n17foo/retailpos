/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/TokenUtils';
import { TokenType } from '../../token/TokenServiceInterface';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import secretsService from '../../secrets/SecretsService';

export class PrestaShopCustomerService extends BaseCustomerService {
  private baseUrl = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.baseUrl = ((await secretsService.getSecret('PRESTASHOP_BASE_URL')) || '').replace(/\/+$/, '');
      if (!this.baseUrl) {
        this.logger.warn('Missing PrestaShop base URL');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.PRESTASHOP);
      if (!ok) {
        this.logger.warn('Failed to initialize PrestaShop token');
        return false;
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.PRESTASHOP, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(token + ':')}`, 'Output-Format': 'JSON' };
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
        const limit = options.limit || 10;
        const offset = options.cursor ? parseInt(options.cursor, 10) : 0;
        let filter = '';
        if (options.query)
          filter = `&filter[email]=[${encodeURIComponent(options.query)}]%25&filter[lastname]=[${encodeURIComponent(options.query)}]%25`;
        const url = `${this.baseUrl}/api/customers?display=full&limit=${offset},${limit}${filter}&output_format=JSON`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`PrestaShop customer search failed: ${response.status}`);
        const body = await response.json();
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
        const url = `${this.baseUrl}/api/customers/${customerId}?output_format=JSON`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) return null;
        const body = await response.json();
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
