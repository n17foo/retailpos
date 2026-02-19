import { ECommercePlatform } from '../../utils/platforms';
import { BasketItem } from '../basket/basket';

/**
 * Status of a local order
 */
export type LocalOrderStatus =
  | 'pending' // Order created, awaiting payment
  | 'processing' // Payment in progress
  | 'paid' // Payment completed
  | 'synced' // Order synced to platform
  | 'failed' // Order/payment failed
  | 'cancelled'; // Order cancelled

/**
 * Represents an order stored locally
 */
export interface LocalOrder {
  id: string;
  platformOrderId?: string;
  platform?: ECommercePlatform;
  items: BasketItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  discountCode?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  giftCardCode?: string;
  giftCardAmount?: number;
  note?: string;
  paymentMethod?: string;
  paymentTransactionId?: string;
  cashierId?: string;
  cashierName?: string;
  status: LocalOrderStatus;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  registerId?: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  syncedAt?: Date;
}

/**
 * Result of checkout operation
 */
export interface CheckoutResult {
  success: boolean;
  orderId: string;
  platformOrderId?: string;
  error?: string;
  /** Signals the UI to open the cash drawer (true when payment method is cash) */
  openDrawer?: boolean;
}

/**
 * Result of sync operation
 */
export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{
    orderId: string;
    error: string;
  }>;
}
