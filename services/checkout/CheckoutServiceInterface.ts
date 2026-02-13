import { ECommercePlatform } from '../../utils/platforms';
import { LocalOrder, LocalOrderStatus, CheckoutResult } from '../order/order';

/**
 * Interface for checkout and order-query operations
 */
export interface CheckoutServiceInterface {
  startCheckout(platform?: ECommercePlatform, cashierId?: string, cashierName?: string): Promise<LocalOrder>;
  markPaymentProcessing(orderId: string): Promise<LocalOrder>;
  completePayment(orderId: string, paymentMethod: string, transactionId?: string): Promise<CheckoutResult>;
  cancelOrder(orderId: string): Promise<void>;
  getLocalOrders(status?: LocalOrderStatus): Promise<LocalOrder[]>;
  getUnsyncedOrders(): Promise<LocalOrder[]>;
  getLocalOrder(orderId: string): Promise<LocalOrder | null>;
}
