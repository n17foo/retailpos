import { CheckoutResult, SyncResult } from '../order/order';

/**
 * Interface for order platform-sync operations
 */
export interface OrderSyncServiceInterface {
  syncOrderToPlatform(orderId: string): Promise<CheckoutResult>;
  syncAllPendingOrders(): Promise<SyncResult>;
  /** Retry syncing a single failed order */
  retrySingleOrder(orderId: string): Promise<CheckoutResult>;
  /** Discard a failed order — marks it as cancelled so it won't be retried */
  discardFailedOrder(orderId: string): Promise<boolean>;
}
