import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useActivePlatform } from './useActivePlatform';
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
export const useUnifiedCategories = (platformParam?: ECommercePlatform | null): UseUnifiedCategoriesReturn => {
  const { platform, isResolved } = useActivePlatform(platformParam);
  const [categories, setCategories] = useState<UnifiedCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

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
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const categoryServiceFactory = CategoryServiceFactory.getInstance();
      const service = categoryServiceFactory.getService(platform);

      if (!service) {
        throw new Error('Category service not available');
      }

      const result = await service.getCategories();
      if (requestId !== requestIdRef.current) return;

      const mappingPlatform = platform || ECommercePlatform.OFFLINE;
      setCategories(mapToUnifiedCategories(result, mappingPlatform));
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
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
    if (isResolved) fetchCategories();
  }, [fetchCategories, isResolved]);

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
export const useCategoryNavigation = (categories: UnifiedCategory[]) => {
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const getCategoryById = useCallback((id: string): UnifiedCategory | undefined => categoryById.get(id), [categoryById]);
  const getChildCategories = useCallback(
    (parentId: string): UnifiedCategory[] => categories.filter(c => c.parentId === parentId),
    [categories]
  );
  const getBreadcrumb = useCallback(
    (categoryId: string): UnifiedCategory[] => {
      const trail = getCategoryAncestors(categories, categoryId)
        .map(getCategoryById)
        .filter((c): c is UnifiedCategory => c !== undefined);
      const category = getCategoryById(categoryId);
      return category ? [...trail, category] : trail;
    },
    [categories, getCategoryById]
  );

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
    displayCategories,
    currentCategory,
    currentCategoryId,
    breadcrumb,
    getCategoryById,
    navigateTo,
    navigateUp,
    navigateToRoot,
    canNavigateUp,
    hasChildren,
  };
};
