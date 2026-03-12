/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { BaseCustomerService } from './BaseCustomerService';
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SquarespaceApiClient } from '../../clients/squarespace/SquarespaceApiClient';

export class SquarespaceCustomerService extends BaseCustomerService {
  private apiClient = SquarespaceApiClient.getInstance();
  constructor() {
    super();
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      if (!this.apiClient.isInitialized()) {
        await this.apiClient.initialize();
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

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.initialized) return { customers: [], hasMore: false };
    try {
      return await withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
        const params: Record<string, string> = {};
        if (options.cursor) params['cursor'] = options.cursor;
        const body = await this.apiClient.get<any>('profiles', params);
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
        const data = await this.apiClient.get<any>(`profiles/${customerId}`);
        return this.mapCustomer(data);
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
