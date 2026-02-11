/**
 * ============================================================================
 * UNIFIED PRODUCT TYPES
 * ============================================================================
 * Canonical product types for the RetailPOS app.
 * All platform-specific product data is mapped to these types via the mappers.
 * The rest of the codebase should ONLY work with these unified types.
 * ============================================================================
 */

import { ECommercePlatform } from '../../utils/platforms';

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export interface UnifiedProductImage {
  id: string;
  url: string;
  alt?: string;
  position: number;
  width?: number;
  height?: number;
  isPrimary: boolean;
}

// ---------------------------------------------------------------------------
// Option
// ---------------------------------------------------------------------------

export interface UnifiedProductOption {
  id: string;
  name: string;
  values: string[];
  position: number;
}

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

export interface UnifiedProductVariant {
  id: string;
  title: string;
  sku?: string;
  barcode?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  inventoryQuantity: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  weight?: number;
  weightUnit: 'g' | 'kg' | 'oz' | 'lb';
  requiresShipping: boolean;
  taxable: boolean;
  taxCode?: string;
  optionValues: string[];
  imageId?: string;
  isAvailable: boolean;
  position: number;
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export type UnifiedProductStatus = 'active' | 'draft' | 'archived';

export interface UnifiedProduct {
  id: string;
  platformId: string;
  platform: ECommercePlatform;
  title: string;
  shortDescription?: string;
  description?: string;
  vendor?: string;
  productType?: string;
  categoryIds: string[];
  tags: string[];
  options: UnifiedProductOption[];
  variants: UnifiedProductVariant[];
  images: UnifiedProductImage[];
  status: UnifiedProductStatus;
  isFeatured: boolean;
  handle?: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Summary (lighter weight for grids / lists)
// ---------------------------------------------------------------------------

export interface UnifiedProductSummary {
  id: string;
  platformId: string;
  platform: ECommercePlatform;
  title: string;
  imageUrl?: string;
  price: number;
  compareAtPrice?: number;
  totalInventory: number;
  inStock: boolean;
  variantCount: number;
  categoryIds: string[];
  productType?: string;
  vendor?: string;
  sku?: string;
  barcode?: string;
  status: UnifiedProductStatus;
}

// ---------------------------------------------------------------------------
// Query / Result
// ---------------------------------------------------------------------------

export interface UnifiedProductQueryOptions {
  page?: number;
  limit?: number;
  categoryId?: string;
  search?: string;
  ids?: string[];
  platform?: ECommercePlatform;
  includeOutOfStock?: boolean;
  status?: UnifiedProductStatus;
  vendor?: string;
  productType?: string;
  tags?: string[];
  sortBy?: 'title' | 'price' | 'createdAt' | 'updatedAt' | 'inventory';
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

export interface UnifiedProductResult {
  products: UnifiedProduct[];
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

export interface UnifiedProductSummaryResult {
  products: UnifiedProductSummary[];
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toProductSummary(product: UnifiedProduct): UnifiedProductSummary {
  const defaultVariant = product.variants[0];
  const primaryImage = product.images.find(img => img.isPrimary) || product.images[0];

  const prices = product.variants.map(v => v.price);
  const lowestPrice = Math.min(...prices);
  const compareAtPrices = product.variants.filter(v => v.compareAtPrice && v.compareAtPrice > v.price).map(v => v.compareAtPrice!);

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

export function getDefaultVariant(product: UnifiedProduct): UnifiedProductVariant | undefined {
  return product.variants.find(v => v.isAvailable) || product.variants[0];
}

export function isOnSale(product: UnifiedProduct): boolean {
  return product.variants.some(v => v.compareAtPrice && v.compareAtPrice > v.price);
}

export function getPriceRange(product: UnifiedProduct): { min: number; max: number } {
  const prices = product.variants.map(v => v.price);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}
