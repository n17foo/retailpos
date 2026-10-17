/**
 * LocalCustomerService
 *
 * CRUD for local_customers and purchase history queries.
 * Called by BasketService.setCustomer() to ensure a local profile exists
 * for every customer attached to a basket.
 *
 * See: docs/specs/customer/crm-loyalty.md §2.1, §2.2
 */

import {
  localCustomerRepository,
  LocalCustomer,
  UpsertLocalCustomerInput,
  UpdateLocalCustomerInput,
} from '../../repositories/LocalCustomerRepository';
import { orderRepository } from '../../../orders-sync/repositories/OrderRepository';
import { orderItemRepository } from '../../../orders-sync/repositories/OrderItemRepository';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

export interface CustomerOrderSummary {
  orderId: string;
  total: number;
  status: string;
  paymentMethod: string | null;
  createdAt: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

export class LocalCustomerService {
  private static instance: LocalCustomerService;
  private logger = LoggerFactory.getInstance().createLogger('LocalCustomerService');

  private constructor() {}

  static getInstance(): LocalCustomerService {
    if (!LocalCustomerService.instance) {
      LocalCustomerService.instance = new LocalCustomerService();
    }
    return LocalCustomerService.instance;
  }

  /**
   * Upsert a local customer profile by email.
   * Called automatically when a customer is attached to the basket.
   */
  async upsert(input: UpsertLocalCustomerInput): Promise<string> {
    return localCustomerRepository.upsert(input);
  }

  async findByEmail(email: string): Promise<LocalCustomer | null> {
    return localCustomerRepository.findByEmail(email);
  }

  async findById(id: string): Promise<LocalCustomer | null> {
    return localCustomerRepository.findById(id);
  }

  async findAll(segment?: string): Promise<LocalCustomer[]> {
    return localCustomerRepository.findAll(segment);
  }

  async update(id: string, input: UpdateLocalCustomerInput, updatedBy?: string): Promise<void> {
    await localCustomerRepository.update(id, input);
    await auditLogService.log('customer:updated', {
      userId: updatedBy,
      details: `Customer ${id} profile updated`,
      metadata: { customerId: id, fields: Object.keys(input) },
    });
  }

  /**
   * Get the last N orders for a customer by email.
   * Joins order_items for line detail.
   */
  async getOrderHistory(email: string, limit = 20): Promise<CustomerOrderSummary[]> {
    try {
      const orders = await orderRepository.findAll();
      const customerOrders = orders
        .filter(o => o.customer_email?.toLowerCase() === email.toLowerCase())
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);

      const summaries: CustomerOrderSummary[] = [];
      for (const order of customerOrders) {
        const itemRows = await orderItemRepository.findByOrderId(order.id);
        summaries.push({
          orderId: order.id,
          total: order.total,
          status: order.status,
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
          items: itemRows.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        });
      }
      return summaries;
    } catch (err) {
      this.logger.error({ message: `Failed to get order history for ${email}` }, err instanceof Error ? err : new Error(String(err)));
      return [];
    }
  }

  /** Called by CheckoutService after a successful payment to update stats */
  async recordOrder(email: string, orderTotal: number): Promise<void> {
    try {
      await localCustomerRepository.recordOrder(email, orderTotal);
    } catch (err) {
      // Non-blocking — stats update failure must not block checkout
      this.logger.warn({ message: `Failed to record order stats for ${email}: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
}

export const localCustomerService = LocalCustomerService.getInstance();
