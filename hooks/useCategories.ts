import { useState, useEffect, useCallback, useMemo } from 'react';
import { CategoryServiceFactory } from '../services/category/CategoryServiceFactory';
import { ECommercePlatform } from '../utils/platforms';
import {
  buildCategoryTree,
  findCategoryInTree,
  getCategoryAncestors,
  getCategoryDescendants,
  toCategorySummary,
  UnifiedCategory,
  UnifiedCategorySummary,
  UnifiedCategoryTree,
} from '../services/category/types';
import { mapToUnifiedCategories } from '../services/category/mappers';

/**
 * Hook state interface
 */
interface UseUnifiedCategoriesState {
  /** Flat list of all categories */
  categories: UnifiedCategory[];
  /** Lightweight category summaries for display */
  categorySummaries: UnifiedCategorySummary[];
  /** Hierarchical category tree */
  categoryTree: UnifiedCategoryTree[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook return interface
 */
interface UseUnifiedCategoriesReturn extends UseUnifiedCategoriesState {
  /** Fetch all categories */
  fetchCategories: () => Promise<void>;
  /** Refresh categories */
  refresh: () => Promise<void>;
  /** Get a single category by ID */
  getCategoryById: (id: string) => UnifiedCategory | undefined;
  /** Get category from tree by ID */
  getCategoryFromTree: (id: string) => UnifiedCategoryTree | undefined;
  /** Get root categories (no parent) */
  getRootCategories: () => UnifiedCategory[];
  /** Get children of a category */
  getChildCategories: (parentId: string) => UnifiedCategory[];
  /** Get ancestor IDs for a category */
  getAncestorIds: (categoryId: string) => string[];
  /** Get descendant IDs for a category */
  getDescendantIds: (categoryId: string) => string[];
  /** Get breadcrumb path for a category */
  getBreadcrumb: (categoryId: string) => UnifiedCategory[];
}

/**
 * Hook for managing unified categories
 * Fetches categories from the configured platform and converts them to unified format
 */
export const useUnifiedCategories = (platform?: ECommercePlatform): UseUnifiedCategoriesReturn => {
  const [categories, setCategories] = useState<UnifiedCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute category summaries from full categories
  const categorySummaries = useMemo(() => {
    return categories.map(toCategorySummary);
  }, [categories]);

  // Build category tree from flat list
  const categoryTree = useMemo(() => {
    return buildCategoryTree(categories);
  }, [categories]);

  // Fetch categories from the service
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const categoryServiceFactory = CategoryServiceFactory.getInstance();
      const service = categoryServiceFactory.getService(platform);

      if (!service) {
        throw new Error('Category service not available');
      }

      const result = await service.getCategories();
      const mappingPlatform = platform || ECommercePlatform.OFFLINE;
      const unifiedCategories = mapToUnifiedCategories(result, mappingPlatform);

      setCategories(unifiedCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setIsLoading(false);
    }
  }, [platform]);

  // Refresh categories
  const refresh = useCallback(async () => {
    await fetchCategories();
  }, [fetchCategories]);

  // Get a single category by ID
  const getCategoryById = useCallback(
    (id: string): UnifiedCategory | undefined => {
      return categories.find(c => c.id === id);
    },
    [categories]
  );

  // Get category from tree by ID
  const getCategoryFromTree = useCallback(
    (id: string): UnifiedCategoryTree | undefined => {
      return findCategoryInTree(categoryTree, id);
    },
    [categoryTree]
  );

  // Get root categories (no parent)
  const getRootCategories = useCallback((): UnifiedCategory[] => {
    return categories.filter(c => !c.parentId);
  }, [categories]);

  // Get children of a category
  const getChildCategories = useCallback(
    (parentId: string): UnifiedCategory[] => {
      return categories.filter(c => c.parentId === parentId);
    },
    [categories]
  );

  // Get ancestor IDs for a category
  const getAncestorIds = useCallback(
    (categoryId: string): string[] => {
      return getCategoryAncestors(categories, categoryId);
    },
    [categories]
  );

  // Get descendant IDs for a category
  const getDescendantIds = useCallback(
    (categoryId: string): string[] => {
      return getCategoryDescendants(categories, categoryId);
    },
    [categories]
  );

  // Get breadcrumb path for a category
  const getBreadcrumb = useCallback(
    (categoryId: string): UnifiedCategory[] => {
      const ancestorIds = getAncestorIds(categoryId);
      const category = getCategoryById(categoryId);

      const breadcrumb = ancestorIds.map(id => getCategoryById(id)).filter((c): c is UnifiedCategory => c !== undefined);

      if (category) {
        breadcrumb.push(category);
      }

      return breadcrumb;
    },
    [getAncestorIds, getCategoryById]
  );

  // Fetch categories on mount and when platform changes
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    categorySummaries,
    categoryTree,
    isLoading,
    error,
    fetchCategories,
    refresh,
    getCategoryById,
    getCategoryFromTree,
    getRootCategories,
    getChildCategories,
    getAncestorIds,
    getDescendantIds,
    getBreadcrumb,
  };
};

/**
 * Helper hook for category navigation
 * Manages current category selection and navigation state
 */
export const useCategoryNavigation = (platform?: ECommercePlatform) => {
  const { categories, categoryTree, isLoading, error, getCategoryById, getChildCategories, getBreadcrumb, refresh } =
    useUnifiedCategories(platform);

  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);

  // Get current category
  const currentCategory = useMemo(() => {
    return currentCategoryId ? getCategoryById(currentCategoryId) : undefined;
  }, [currentCategoryId, getCategoryById]);

  // Get categories to display (children of current or root)
  const displayCategories = useMemo(() => {
    if (currentCategoryId) {
      return getChildCategories(currentCategoryId);
    }
    return categories.filter(c => !c.parentId);
  }, [currentCategoryId, categories, getChildCategories]);

  // Get breadcrumb for current category
  const breadcrumb = useMemo(() => {
    return currentCategoryId ? getBreadcrumb(currentCategoryId) : [];
  }, [currentCategoryId, getBreadcrumb]);

  // Navigate to a category
  const navigateTo = useCallback((categoryId: string | null) => {
    setCurrentCategoryId(categoryId);
  }, []);

  // Navigate to parent
  const navigateUp = useCallback(() => {
    if (currentCategory?.parentId) {
      setCurrentCategoryId(currentCategory.parentId);
    } else {
      setCurrentCategoryId(null);
    }
  }, [currentCategory]);

  // Navigate to root
  const navigateToRoot = useCallback(() => {
    setCurrentCategoryId(null);
  }, []);

  // Check if a category has children
  const hasChildren = useCallback(
    (categoryId: string): boolean => {
      return categories.some(c => c.parentId === categoryId);
    },
    [categories]
  );

  // Check if we can navigate up
  const canNavigateUp = currentCategoryId !== null;

  return {
    categories,
    categoryTree,
    displayCategories,
    currentCategory,
    currentCategoryId,
    breadcrumb,
    isLoading,
    error,
    navigateTo,
    navigateUp,
    navigateToRoot,
    canNavigateUp,
    hasChildren,
    refresh,
  };
};
