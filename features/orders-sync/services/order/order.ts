import { ECommercePlatform } from '../../../../shared/utils/platforms';
import { BasketItem } from '../../../basket/services/basket';

export type PaymentMethod = 'cash' | 'card' | 'card_terminal' | 'store_credit' | 'loyalty' | 'gift_card' | 'other';

export interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: number; // positive = payment, negative = refund/credit
  transactionId?: string;
  cardBrand?: string;
  last4?: string;
  processedAt: number; // Unix ms
  note?: string;
}

/**
 * Status of a local order
 */
export type LocalOrderStatus =
  | 'draft' // Platform draft created, awaiting payment confirmation
  | 'pending' // Order created locally (offline), awaiting payment
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
  /** Fulfilment mode selected at sale time ('counter' | 'pickup' | 'delivery' | …) — spec 6.36 */
  saleMode?: string;
  paymentMethod?: string;
  paymentTransactionId?: string;
  /** Multi-tender payment lines. Populated for split-tender orders. */
  payments?: PaymentLine[];
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
  payments?: PaymentLine[];
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
