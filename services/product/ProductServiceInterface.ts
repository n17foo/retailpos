/**
 * Options for querying products
 */
export interface ProductQueryOptions {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  ids?: string[];
  includeOutOfStock?: boolean;
  /** Cursor for cursor-based pagination (used by Shopify) */
  cursor?: string;
}

/**
 * Results from a product query
 */
export interface ProductResult {
  products: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    perPage?: number; // Made optional to maintain compatibility with existing code
    /** Cursor to fetch the next page (for cursor-based pagination) */
    nextCursor?: string;
    /** Cursor to fetch the previous page (for cursor-based pagination) */
    prevCursor?: string;
  };
}

/**
 * Represents a product
 */
export interface Product {
  id: string;
  title: string;
  description?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  options?: ProductOption[];
  variants: ProductVariant[];
  images?: ProductImage[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Represents a product option (e.g., Size, Color)
 */
export interface ProductOption {
  id?: string;
  name: string;
  values: string[];
}

/**
 * Represents a product variant
 */
export interface ProductVariant {
  id: string;
  title?: string;
  sku?: string;
  barcode?: string;
  price: number;
  compareAtPrice?: number;
  inventoryQuantity: number;
  weight?: number;
  weightUnit?: 'g' | 'kg' | 'oz' | 'lb';
  requiresShipping?: boolean;
  taxable?: boolean;
  options?: string[];
  imageId?: string;
}

/**
 * Represents a product image
 */
export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  position?: number;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  successful: number;
  failed: number;
  errors: Array<{
    productId: string;
    error: string;
  }>;
}

/**
 * Interface for product-related operations in an e-commerce platform
 */
export interface ProductServiceInterface {
  /**
   * Get products from the e-commerce platform
   * @param options Options to filter the products
   * @returns Promise resolving to a list of products and pagination info
   */
  getProducts(options: ProductQueryOptions): Promise<ProductResult>;

  /**
   * Sync products from POS to e-commerce platform
   * @param products Products to sync to the platform
   * @returns Promise resolving to the results of the sync operation
   */
  syncProducts(products: Product[]): Promise<SyncResult>;
}
