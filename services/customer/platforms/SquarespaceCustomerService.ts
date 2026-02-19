import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import secretsService from '../../secrets/secretsService';

export class SquarespaceCustomerService extends BaseCustomerService {
  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      const ok = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SQUARESPACE);
      if (!ok) {
        this.logger.warn('Failed to initialize Squarespace token');
        return false;
      }
      this.initialized = true;
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getPlatformToken(ECommercePlatform.SQUARESPACE, TokenType.ACCESS);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` };
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        const headers = await this.getAuthHeaders();
        const params = new URLSearchParams();
        if (options.cursor) params.append('cursor', options.cursor);
        const url = `https://api.squarespace.com/1.0/profiles?${params}`;
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Squarespace customer search failed: ${response.status}`);
        const body = await response.json();
        const allProfiles = body.profiles || [];
        const query = (options.query || '').toLowerCase();
        const filtered = query
          ? allProfiles.filter(
              (p: any) =>
                (p.email || '').toLowerCase().includes(query) ||
                (p.firstName || '').toLowerCase().includes(query) ||
                (p.lastName || '').toLowerCase().includes(query)
            )
          : allProfiles;
        const customers: PlatformCustomer[] = filtered.slice(0, options.limit || 10).map((c: any) => this.mapCustomer(c));
        return { customers, hasMore: !!body.pagination?.nextPageCursor, nextCursor: body.pagination?.nextPageCursor };
      });
    } catch (error) {
      this.logger.error({ message: 'Error searching Squarespace customers' }, error instanceof Error ? error : new Error(String(error)));
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.initialized) return null;
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        const headers = await this.getAuthHeaders();
        const response = await fetch(`https://api.squarespace.com/1.0/profiles/${customerId}`, { headers });
        if (!response.ok) return null;
        return this.mapCustomer(await response.json());
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching Squarespace customer' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private mapCustomer(c: any): PlatformCustomer {
    return {
      id: c.id || '',
      platformId: c.id || '',
      platform: ECommercePlatform.SQUARESPACE,
      email: c.email || '',
      firstName: c.firstName,
      lastName: c.lastName,
      orderCount: c.orderCount,
      totalSpent: c.totalOrderAmount ? parseFloat(c.totalOrderAmount.value || '0') : undefined,
      createdAt: c.createdOn ? new Date(c.createdOn) : undefined,
    };
  }
}
