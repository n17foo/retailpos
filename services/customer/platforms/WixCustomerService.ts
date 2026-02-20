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

export class WixCustomerService extends BaseCustomerService {
  private siteId = '';

  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('WixCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.siteId = (await secretsService.getSecret('WIX_SITE_ID')) || '';
      if (!this.siteId) {
        this.logger.warn('Missing Wix site ID');
        return false;
      }
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WIX);
      if (!ok) {
        this.logger.warn('Failed to initialize Wix token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Wix customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.WIX, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: token || '', 'wix-site-id': this.siteId };
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        const limit = options.limit || 10;
        const headers = await this.getAuthHeaders();
        const body: any = { search: { expression: options.query || '' }, paging: { limit } };
        if (options.cursor) body.paging.offset = parseInt(options.cursor, 10);
        const response = await fetch('https://www.wixapis.com/contacts/v4/contacts/search', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`Wix customer search failed: ${response.status}`);
        const data = await response.json();
        const customers: PlatformCustomer[] = (data.contacts || []).map((c: any) => this.mapCustomer(c));
        const total = data.pagingMetadata?.total || 0;
        const offset = (options.cursor ? parseInt(options.cursor, 10) : 0) + limit;
        return { customers, hasMore: offset < total, nextCursor: offset < total ? String(offset) : undefined };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching Wix customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;
    try {
      return await withTokenRefresh(ECommercePlatform.WIX, async () => {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`https://www.wixapis.com/contacts/v4/contacts/${customerId}`, { headers });
        if (!response.ok) return null;
        const data = await response.json();
        return this.mapCustomer(data.contact || data);
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching Wix customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    const primaryEmail = c.primaryInfo?.email || c.emails?.items?.[0]?.email || '';
    const primaryPhone = c.primaryInfo?.phone || c.phones?.items?.[0]?.phone || '';
    return {
      id: c.id || '',
      platformId: c.id || '',
      platform: ECommercePlatform.WIX,
      email: primaryEmail,
      firstName: c.info?.name?.first || c.name?.first,
      lastName: c.info?.name?.last || c.name?.last,
      phone: primaryPhone || undefined,
      createdAt: c.createdDate ? new Date(c.createdDate) : undefined,
      updatedAt: c.updatedDate ? new Date(c.updatedDate) : undefined,
    };
  }
}
