/**
 * ============================================================================
 * UNIFIED CATEGORY TYPES
 * ============================================================================
 * Canonical category types for the RetailPOS app.
 * All platform-specific category data is mapped to these types via the mappers.
 * The rest of the codebase should ONLY work with these unified types.
 * ============================================================================
 */

import { ECommercePlatform } from '../../utils/platforms';

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export interface UnifiedCategoryImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export type UnifiedCategoryStatus = 'active' | 'hidden' | 'archived';

export interface UnifiedCategory {
  id: string;
  platformId: string;
  platform: ECommercePlatform;
  name: string;
  description?: string;
  handle?: string;
  parentId?: string;
  image?: UnifiedCategoryImage;
  position: number;
  productCount: number;
  status: UnifiedCategoryStatus;
  isFeatured: boolean;
  level: number;
  path: string[];
  createdAt?: Date;
  updatedAt?: Date;
  syncedAt: Date;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export interface UnifiedCategoryTree extends UnifiedCategory {
  children: UnifiedCategoryTree[];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface UnifiedCategorySummary {
  id: string;
  platformId: string;
  platform: ECommercePlatform;
  name: string;
  imageUrl?: string;
  parentId?: string;
  productCount: number;
  level: number;
  position: number;
  pathString: string;
}

// ---------------------------------------------------------------------------
// Query / Result
// ---------------------------------------------------------------------------

export interface UnifiedCategoryResult {
  categories: UnifiedCategory[];
  totalCount: number;
}

export interface UnifiedCategoryTreeResult {
  tree: UnifiedCategoryTree[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export function buildCategoryTree(categories: UnifiedCategory[]): UnifiedCategoryTree[] {
  const categoryMap = new Map<string, UnifiedCategoryTree>();
  const roots: UnifiedCategoryTree[] = [];

  categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  categories.forEach(cat => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (nodes: UnifiedCategoryTree[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

export function findCategoryInTree(tree: UnifiedCategoryTree[], id: string): UnifiedCategoryTree | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    const found = findCategoryInTree(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export function getCategoryAncestors(categories: UnifiedCategory[], categoryId: string): string[] {
  const ancestors: string[] = [];
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  let current = categoryMap.get(categoryId);
  while (current?.parentId) {
    ancestors.unshift(current.parentId);
    current = categoryMap.get(current.parentId);
  }

  return ancestors;
}

export function getCategoryDescendants(categories: UnifiedCategory[], categoryId: string): string[] {
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
