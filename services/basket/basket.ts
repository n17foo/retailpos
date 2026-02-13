import { ECommercePlatform } from '../../utils/platforms';

/**
 * Represents an item in the basket
 */
export interface BasketItem {
  id: string;
  productId: string;
  variantId?: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  taxable: boolean;
  taxRate?: number;
  isEcommerceProduct?: boolean;
  originalId?: string; // Original platform ID for ecommerce products
  properties?: Record<string, string>;
}

/**
 * Represents the current basket state
 */
export interface Basket {
  id: string;
  items: BasketItem[];
  subtotal: number;
  tax: number;
  total: number;
  discountAmount?: number;
  discountCode?: string;
  customerEmail?: string;
  customerName?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
