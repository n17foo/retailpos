/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { CustomerSearchOptions, CustomerSearchResult, PlatformCustomer } from '../CustomerServiceInterface';
import { BaseCustomerService } from './BaseCustomerService';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { ECommercePlatform } from '../../../utils/platforms';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { toDollars } from '../../../utils/money';

/**
 * Commercefull platform implementation of the customer service.
 *
 * Endpoint mapping:
 *   GET /business/customers?search=...  → searchCustomers
 *   GET /business/customers/:id         → getCustomer
 */
export class CommercefullCustomerService extends BaseCustomerService {
  private config: Record<string, any>;
  private apiClient: CommercefullApiClient;

  constructor(config: Record<string, any> = {}) {
    super();
    this.config = config;
    this.apiClient = CommercefullApiClient.getInstance();
    // Override the logger with a more specific name
    this.logger = LoggerFactory.getInstance().createLogger('CommercefullCustomerService');
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommercefullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) {
        this.initialized = true;
      }
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Commercefull customer service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async searchCustomers(options: CustomerSearchOptions): Promise<CustomerSearchResult> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull customer service not initialized');
    }

    try {
      const limit = options.limit || 20;
      const offset = options.cursor ? parseInt(options.cursor, 10) || 0 : 0;

      const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
      if (options.query) params.search = options.query;

      const data = await this.apiClient.get<any>('/business/customers', params);
      // Response: { data: PaginatedResult<Customer> } where PaginatedResult
      // is { data: Customer[], total, limit, offset, hasMore }.
      const payload = data?.data || {};
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : payload.customers || [];
      const customers: PlatformCustomer[] = rows.map((c: any) => this.mapToCustomer(c));

      const hasMore = payload.hasMore === true;
      return {
        customers,
        hasMore,
        nextCursor: hasMore ? String(offset + limit) : undefined,
      };
    } catch (error) {
      this.logger.error(
        { message: 'Error searching customers on Commercefull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { customers: [], hasMore: false };
    }
  }

  async getCustomer(customerId: string): Promise<PlatformCustomer | null> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull customer service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/business/customers/${customerId}`);
      const customer = data?.data || data;
      if (!customer || !(customer.customerId || customer.id)) return null;
      return this.mapToCustomer(customer);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching customer ${customerId} from Commercefull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  private mapToCustomer(c: any): PlatformCustomer {
    if (!c) {
      return {
        id: '',
        platformId: '',
        platform: ECommercePlatform.COMMERCEFULL,
        email: '',
      };
    }

    return {
      id: String(c.customerId || c.id || ''),
      platformId: String(c.customerId || c.id || ''),
      platform: ECommercePlatform.COMMERCEFULL,
      email: c.email || '',
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      phone: c.phone || '',
      tags: c.tags || [],
      orderCount: c.orderCount,
      totalSpent: c.totalSpentCents != null ? toDollars(c.totalSpentCents) : c.totalSpent,
      currency: c.preferredCurrency || c.currency,
      note: c.note || c.notes || '',
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
    };
  }
}
