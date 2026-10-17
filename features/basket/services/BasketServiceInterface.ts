// Re-export shared types so existing consumers don't break
export type { BasketItem, Basket } from './basket';
export type { LocalOrder, LocalOrderStatus, CheckoutResult, SyncResult } from '../../orders-sync/services/order/order';

import type { Basket, BasketItem } from './basket';
import type { ECommercePlatform } from '../../../shared/utils/platforms';

/**
 * Interface for basket service operations (cart CRUD only)
 */
export interface BasketServiceInterface {
  initialize(): Promise<void>;
  getBasket(): Promise<Basket>;
  addItem(item: Omit<BasketItem, 'id'>): Promise<Basket>;
  updateItemQuantity(itemId: string, quantity: number): Promise<Basket>;
  removeItem(itemId: string): Promise<Basket>;
  clearBasket(): Promise<void>;
  applyDiscount(code: string, platform?: ECommercePlatform): Promise<Basket>;
  removeDiscount(): Promise<Basket>;
  setCustomer(email?: string, name?: string): Promise<Basket>;
  setNote(note: string): Promise<Basket>;
  setSaleMode(mode: string | undefined): Promise<Basket>;
  /** Replace a line's free-form properties (e.g. a per-line note) */
  updateItemProperties(itemId: string, properties: Record<string, string>): Promise<Basket>;
}
