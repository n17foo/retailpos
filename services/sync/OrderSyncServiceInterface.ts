import { CheckoutResult, SyncResult } from '../order/order';

/**
 * Interface for order platform-sync operations
 */
export interface OrderSyncServiceInterface {
  syncOrderToPlatform(orderId: string): Promise<CheckoutResult>;
  syncAllPendingOrders(): Promise<SyncResult>;
}
