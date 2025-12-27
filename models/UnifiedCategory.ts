import { ECommercePlatform } from '../utils/platforms';

/**
 * ============================================================================
 * UNIFIED CATEGORY SCHEMA
 * ============================================================================
 * This is the single source of truth for category data in the RetailPOS app.
 * All platform-specific category data should be mapped to this schema.
 * The app should ONLY work with these unified types, never platform-specific ones.
 * ============================================================================
 */

/**
 * Category image
 */
export interface UnifiedCategoryImage {
  /** Image URL */
  url: string;
  /** Alt text */
  alt?: string;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
}

/**
 * Category status
 */
export type UnifiedCategoryStatus = 'active' | 'hidden' | 'archived';

/**
 * Unified category
 * Represents a product category/collection
 */
export interface UnifiedCategory {
  /** Unique identifier in the app */
  id: string;
  
  /** Original platform ID (before any prefixing) */
  platformId: string;
  
  /** Source platform */
  platform: ECommercePlatform;
  
  /** Category name */
  name: string;
  
  /** Category description */
  description?: string;
  
  /** SEO-friendly URL handle/slug */
  handle?: string;
  
  /** Parent category ID (for hierarchical categories) */
  parentId?: string;
  
  /** Category image */
  image?: UnifiedCategoryImage;
  
  /** Display order (lower = first) */
  position: number;
  
  /** Number of products in this category */
  productCount: number;
  
  /** Category status */
  status: UnifiedCategoryStatus;
  
  /** Whether this is a featured/highlighted category */
  isFeatured: boolean;
  
  /** Depth level in hierarchy (0 = root) */
  level: number;
  
  /** Full path of category names (e.g., ["Clothing", "Men", "Shirts"]) */
  path: string[];
  
  /** When the category was created */
  createdAt?: Date;
  
  /** When the category was last updated */
  updatedAt?: Date;
  
  /** When the category was last synced from platform */
  syncedAt: Date;
  
  /** 
   * Platform-specific metadata
   * Store any platform-specific data that doesn't fit the unified schema
   */
  metadata?: Record<string, unknown>;
}

/**
 * Category with nested children (for tree display)
 */
export interface UnifiedCategoryTree extends UnifiedCategory {
  /** Child categories */
  children: UnifiedCategoryTree[];
}

/**
 * Simplified category for display in lists/selectors
 */
export interface UnifiedCategorySummary {
  /** Unique identifier */
  id: string;
  /** Platform ID */
  platformId: string;
  /** Source platform */
  platform: ECommercePlatform;
  /** Category name */
  name: string;
  /** Image URL */
  imageUrl?: string;
  /** Parent category ID */
  parentId?: string;
  /** Number of products */
  productCount: number;
  /** Depth level */
  level: number;
  /** Display order */
  position: number;
  /** Full path as string (e.g., "Clothing > Men > Shirts") */
  pathString: string;
}

/**
 * Result for category queries
 */
export interface UnifiedCategoryResult {
  /** List of categories */
  categories: UnifiedCategory[];
  /** Total count */
  totalCount: number;
}

/**
 * Result for category tree queries
 */
export interface UnifiedCategoryTreeResult {
  /** Category tree (root categories with nested children) */
  tree: UnifiedCategoryTree[];
  /** Total count of all categories */
  totalCount: number;
}

/**
 * Helper to create a category summary from a full category
 */
export function toCategorySummary(category: UnifiedCategory): UnifiedCategorySummary {
  return {
    id: category.id,
    platformId: category.platformId,
    platform: category.platform,
    name: category.name,
    imageUrl: category.image?.url,
    parentId: category.parentId,
    productCount: category.productCount,
    level: category.level,
    position: category.position,
    pathString: category.path.join(' > '),
  };
}

/**
 * Helper to build a category tree from a flat list
 */
export function buildCategoryTree(categories: UnifiedCategory[]): UnifiedCategoryTree[] {
  const categoryMap = new Map<string, UnifiedCategoryTree>();
  const roots: UnifiedCategoryTree[] = [];
  
  // First pass: create tree nodes
  categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });
  
  // Second pass: build tree structure
  categories.forEach(cat => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  
  // Sort children by position
  const sortChildren = (nodes: UnifiedCategoryTree[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);
  
  return roots;
}

/**
 * Helper to find a category by ID in a tree
 */
export function findCategoryInTree(
  tree: UnifiedCategoryTree[],
  id: string
): UnifiedCategoryTree | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findCategoryInTree(node.children, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Helper to get all ancestor IDs for a category
 */
export function getCategoryAncestors(
  categories: UnifiedCategory[],
  categoryId: string
): string[] {
  const ancestors: string[] = [];
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  
  let current = categoryMap.get(categoryId);
  while (current?.parentId) {
    ancestors.unshift(current.parentId);
    current = categoryMap.get(current.parentId);
  }
  
  return ancestors;
}

/**
 * Helper to get all descendant IDs for a category
 */
export function getCategoryDescendants(
  categories: UnifiedCategory[],
  categoryId: string
): string[] {
  const descendants: string[] = [];
  
  const findChildren = (parentId: string) => {
    categories
      .filter(c => c.parentId === parentId)
      .forEach(child => {
        descendants.push(child.id);
        findChildren(child.id);
      });
  };
  
  findChildren(categoryId);
  return descendants;
}
