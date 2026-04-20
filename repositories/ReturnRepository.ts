import { instoreApiConfig } from '../services/instoreapi/InstoreApiConfig';
import { OfflineReturnRepository } from './OfflineReturnRepository';
import { InstoreApiReturnRepository } from './InstoreApiReturnRepository';

export interface ReturnRow {
  id: string;
  order_id: string;
  order_item_id: string | null;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  quantity: number;
  refund_amount: number;
  reason: string | null;
  restock: number;
  status: string;
  processed_by: string | null;
  processed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface CreateReturnInput {
  orderId: string;
  orderItemId?: string | null;
  productId: string;
  variantId?: string | null;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason?: string | null;
  restock?: boolean;
}

/**
 * Contract for return persistence.
 * Implemented by OfflineReturnRepository (SQLite) and LocalApiReturnRepository (HTTP).
 * Use getReturnRepository() to get the right implementation for the current mode.
 */
export interface ReturnRepository {
  create(input: CreateReturnInput): Promise<string>;
  findById(id: string): Promise<ReturnRow | null>;
  findByOrderId(orderId: string): Promise<ReturnRow[]>;
  findAll(status?: string): Promise<ReturnRow[]>;
  findByDateRange(from: number, to: number): Promise<ReturnRow[]>;
  updateStatus(id: string, status: string, processedBy?: string): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Singleton offline instance for direct use in standalone/server mode */
export const returnRepository = new OfflineReturnRepository();

/**
 * Factory — returns the right ReturnRepository implementation for the current mode.
 * Standalone / server → OfflineReturnRepository (SQLite)
 * Client             → LocalApiReturnRepository (HTTP to server register)
 */
export function getReturnRepository(): ReturnRepository {
  if (instoreApiConfig.isClient) {
    return new InstoreApiReturnRepository();
  }
  return returnRepository;
}
