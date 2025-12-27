import { ECommercePlatform } from '../utils/platforms';

/**
 * ============================================================================
 * UNIFIED PRODUCT SCHEMA
 * ============================================================================
 * This is the single source of truth for product data in the RetailPOS app.
 * All platform-specific product data should be mapped to this schema.
 * The app should ONLY work with these unified types, never platform-specific ones.
 * ============================================================================
 */

/**
 * Unified product image
 */
export interface UnifiedProductImage {
  /** Unique identifier for the image */
  id: string;
  /** URL to the image */
  url: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Display order (lower = first) */
  position: number;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Whether this is the primary/featured image */
  isPrimary: boolean;
}

/**
 * Unified product option (e.g., Size, Color)
 */
export interface UnifiedProductOption {
  /** Unique identifier */
  id: string;
  /** Option name (e.g., "Size", "Color") */
  name: string;
  /** Available values (e.g., ["S", "M", "L", "XL"]) */
  values: string[];
  /** Display order */
  position: number;
}

/**
 * Unified product variant
 * Represents a specific purchasable version of a product
 */
export interface UnifiedProductVariant {
  /** Unique identifier */
  id: string;
  /** Variant title (e.g., "Large / Blue") */
  title: string;
  /** Stock Keeping Unit */
  sku?: string;
  /** Barcode (UPC, EAN, ISBN, etc.) */
  barcode?: string;
  /** Current selling price */
  price: number;
  /** Original price before discount (for showing savings) */
  compareAtPrice?: number;
  /** Cost price (for profit calculations) */
  costPrice?: number;
  /** Current inventory quantity */
  inventoryQuantity: number;
  /** Whether to track inventory */
  trackInventory: boolean;
  /** Whether to allow sales when out of stock */
  allowBackorder: boolean;
  /** Weight value */
  weight?: number;
  /** Weight unit */
  weightUnit: 'g' | 'kg' | 'oz' | 'lb';
  /** Whether shipping is required */
  requiresShipping: boolean;
  /** Whether tax should be applied */
  taxable: boolean;
  /** Tax class/code for tax calculations */
  taxCode?: string;
  /** Selected option values (e.g., ["Large", "Blue"]) */
  optionValues: string[];
  /** Reference to variant-specific image */
  imageId?: string;
  /** Whether this variant is available for sale */
  isAvailable: boolean;
  /** Display order */
  position: number;
}

/**
 * Product status
 */
export type UnifiedProductStatus = 'active' | 'draft' | 'archived';

/**
 * Unified product
 * The main product entity that the app works with
 */
export interface UnifiedProduct {
  /** Unique identifier in the app */
  id: string;
  
  /** Original platform ID (before any prefixing) */
  platformId: string;
  
  /** Source platform */
  platform: ECommercePlatform;
  
  /** Product title/name */
  title: string;
  
  /** Short description for listings */
  shortDescription?: string;
  
  /** Full HTML description */
  description?: string;
  
  /** Vendor/brand name */
  vendor?: string;
  
  /** Product type/category name */
  productType?: string;
  
  /** Category IDs this product belongs to */
  categoryIds: string[];
  
  /** Searchable tags */
  tags: string[];
  
  /** Product options (Size, Color, etc.) */
  options: UnifiedProductOption[];
  
  /** Product variants */
  variants: UnifiedProductVariant[];
  
  /** Product images */
  images: UnifiedProductImage[];
  
  /** Product status */
  status: UnifiedProductStatus;
  
  /** Whether product is featured/highlighted */
  isFeatured: boolean;
  
  /** SEO-friendly URL handle/slug */
  handle?: string;
  
  /** When the product was created */
  createdAt: Date;
  
  /** When the product was last updated */
  updatedAt: Date;
  
  /** When the product was last synced from platform */
  syncedAt: Date;
  
  /** 
   * Platform-specific metadata
   * Store any platform-specific data that doesn't fit the unified schema
   */
  metadata?: Record<string, unknown>;
}

/**
 * Simplified product for display in grids/lists
 * Used to reduce memory usage when displaying many products
 */
export interface UnifiedProductSummary {
  /** Unique identifier */
  id: string;
  /** Platform ID */
  platformId: string;
  /** Source platform */
  platform: ECommercePlatform;
  /** Product title */
  title: string;
  /** Primary image URL */
  imageUrl?: string;
  /** Lowest variant price */
  price: number;
  /** Original price (if on sale) */
  compareAtPrice?: number;
  /** Total inventory across all variants */
  totalInventory: number;
  /** Whether any variant is in stock */
  inStock: boolean;
  /** Number of variants */
  variantCount: number;
  /** Category IDs */
  categoryIds: string[];
  /** Product type */
  productType?: string;
  /** Vendor */
  vendor?: string;
  /** SKU of first/default variant */
  sku?: string;
  /** Barcode of first/default variant */
  barcode?: string;
  /** Product status */
  status: UnifiedProductStatus;
}

/**
 * Query options for fetching products
 */
export interface UnifiedProductQueryOptions {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Filter by category ID */
  categoryId?: string;
  /** Search query */
  search?: string;
  /** Filter by specific IDs */
  ids?: string[];
  /** Filter by platform */
  platform?: ECommercePlatform;
  /** Include out of stock products */
  includeOutOfStock?: boolean;
  /** Filter by status */
  status?: UnifiedProductStatus;
  /** Filter by vendor */
  vendor?: string;
  /** Filter by product type */
  productType?: string;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Sort field */
  sortBy?: 'title' | 'price' | 'createdAt' | 'updatedAt' | 'inventory';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

/**
 * Paginated result for product queries
 */
export interface UnifiedProductResult {
  /** List of products */
  products: UnifiedProduct[];
  /** Pagination info */
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    /** Cursor for next page (for cursor-based pagination) */
    nextCursor?: string;
    /** Cursor for previous page */
    prevCursor?: string;
  };
}

/**
 * Result for product summary queries (lighter weight)
 */
export interface UnifiedProductSummaryResult {
  /** List of product summaries */
  products: UnifiedProductSummary[];
  /** Pagination info */
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

/**
 * Helper to create a product summary from a full product
 */
export function toProductSummary(product: UnifiedProduct): UnifiedProductSummary {
  const defaultVariant = product.variants[0];
  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];
  
  const prices = product.variants.map(v => v.price);
  const lowestPrice = Math.min(...prices);
  const compareAtPrices = product.variants
    .filter(v => v.compareAtPrice && v.compareAtPrice > v.price)
    .map(v => v.compareAtPrice!);
  
  const totalInventory = product.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);
  const inStock = product.variants.some(v => v.isAvailable && v.inventoryQuantity > 0);
  
  return {
    id: product.id,
    platformId: product.platformId,
    platform: product.platform,
    title: product.title,
    imageUrl: primaryImage?.url,
    price: lowestPrice,
    compareAtPrice: compareAtPrices.length > 0 ? Math.min(...compareAtPrices) : undefined,
    totalInventory,
    inStock,
    variantCount: product.variants.length,
    categoryIds: product.categoryIds,
    productType: product.productType,
    vendor: product.vendor,
    sku: defaultVariant?.sku,
    barcode: defaultVariant?.barcode,
    status: product.status,
  };
}

/**
 * Helper to get the default/first variant
 */
export function getDefaultVariant(product: UnifiedProduct): UnifiedProductVariant | undefined {
  return product.variants.find(v => v.isAvailable) || product.variants[0];
}

/**
 * Helper to check if a product is on sale
 */
export function isOnSale(product: UnifiedProduct): boolean {
  return product.variants.some(v => v.compareAtPrice && v.compareAtPrice > v.price);
}

/**
 * Helper to get price range
 */
export function getPriceRange(product: UnifiedProduct): { min: number; max: number } {
  const prices = product.variants.map(v => v.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}
