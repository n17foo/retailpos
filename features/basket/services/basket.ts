/**
 * Represents an item in the basket.
 *
 * Every basket line points to the platform's actual sellable unit and stores
 * an immutable snapshot of what was sold at add-to-cart time. This snapshot
 * is persisted to order_items so receipts and refunds are always accurate
 * even if the platform catalog changes later.
 *
 * Sellable unit by platform:
 *   Shopify       → ProductVariant (variantId)
 *   WooCommerce   → variation for variable products; plain product for simple
 *   Magento       → concrete simple SKU selected through configurable options
 *   BigCommerce   → variant (variantId maps to SKU + inventory)
 *   Sylius        → productVariantCode (stored in variantId)
 *   Wix           → variant (variantId)
 *   PrestaShop    → combination (variantId = combination id)
 *   Offline       → local product id
 */
export interface BasketItem {
  id: string;
  productId: string;
  /** Platform sellable unit id (variant, combination, simple SKU, etc.) */
  variantId?: string;
  sku?: string;
  name: string;
  /** Human-readable option summary, e.g. "Size: M / Color: Red" */
  optionSummary?: string;
  price: number;
  quantity: number;
  image?: string;
  isEcommerceProduct?: boolean;
  /** Original platform product/parent id (for ecommerce products) */
  originalId?: string;
  /** Platform-specific tax class or code (online platforms) */
  taxCode?: string;
  /** Tax profile id for offline/local tax calculation */
  taxProfileId?: string;
  /** Tax rate snapshot at add-to-cart time (0–1, e.g. 0.2 for 20%) */
  taxRate?: number;
  /** Whether the item is taxable */
  taxable?: boolean;
  /** Inventory policy: 'deny' blocks oversell, 'continue' allows it */
  inventoryPolicy?: 'deny' | 'continue';
  /** Catalog version or syncedAt timestamp — used to detect stale snapshots */
  catalogVersion?: string;
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
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  note?: string;
  registerId?: string;
  /** Fulfilment mode for this sale ('counter' | 'pickup' | 'delivery' | …) — spec 6.36 */
  saleMode?: string;
  createdAt: Date;
  updatedAt: Date;
}
