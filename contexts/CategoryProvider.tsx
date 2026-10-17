import React, { ReactNode, createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useUnifiedCategories } from '../hooks/useCategories';
import { UnifiedCategory } from '../services/category/types';
import {
  CategorySelectionState,
  EMPTY_SELECTION,
  SubRowModel,
  effectiveCategoryId,
  getSubRow,
  goUp as goUpSelection,
  selectRoot as selectRootSelection,
  selectSub as selectSubSelection,
} from '../utils/categorySelection';

/**
 * Category state for the sale screen (docs/specs/system/sales-screen-fast-path-ux.md §5.2).
 *
 * Owns the single category-tree instance for the app (`useUnifiedCategories` must be
 * called here exactly once — screens consume this context) and the two-row /
 * drill-down selection model. The initial selection is `null` ("All Products", D2).
 */
export interface CategoryContextType {
  categories: UnifiedCategory[];
  isLoading: boolean;
  /** Top-level categories rendered in row 1 after the "All" button */
  rootCategories: UnifiedCategory[];
  /** Row-2 model: parent chip + children, or empty when no sub row exists */
  subRow: SubRowModel;
  /** Selected root id — null means "All Products" */
  selectedRootId: string | null;
  /** Deepest selected sub-category id — null means "All {root}" or "All Products" */
  selectedSubId: string | null;
  /** The category the product grid filters by (root id, sub id, or null for all) */
  effectiveCategoryId: string | null;
  /** Children of a category */
  childrenOf: (id: string) => UnifiedCategory[];
  /** Descendant ids of a category (for subtree product filtering) */
  descendantIds: (id: string) => string[];
  /** Select a category: null = All Products, a root = root row, deeper = sub row */
  select: (id: string | null) => void;
  /** Step the drill-down row back up one level ("‹" chip) */
  goUp: () => void;
  /** Reset to All Products */
  clear: () => void;
}

export const CategoryContext = createContext<CategoryContextType | null>(null);

export const CategoryProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const { categories, isLoading, getRootCategories, getChildCategories, getDescendantIds } = useUnifiedCategories();
  const [selection, setSelection] = useState<CategorySelectionState>(EMPTY_SELECTION);

  const select = useCallback(
    (id: string | null) => {
      setSelection(prev => {
        if (id === null) return EMPTY_SELECTION;
        const category = categories.find(c => c.id === id);
        if (!category) return prev;
        return category.parentId ? selectSubSelection(prev, id, categories) : selectRootSelection(prev, id);
      });
    },
    [categories]
  );

  const goUp = useCallback(() => {
    setSelection(prev => goUpSelection(prev, categories));
  }, [categories]);

  const clear = useCallback(() => {
    setSelection(EMPTY_SELECTION);
  }, []);

  const childrenOf = useCallback((id: string) => getChildCategories(id), [getChildCategories]);

  const descendantIds = useCallback((id: string) => getDescendantIds(id), [getDescendantIds]);

  const rootCategories = useMemo(() => getRootCategories(), [getRootCategories]);
  const subRow = useMemo(() => getSubRow(selection, categories), [selection, categories]);

  const value = useMemo<CategoryContextType>(
    () => ({
      categories,
      isLoading,
      rootCategories,
      subRow,
      selectedRootId: selection.rootId,
      selectedSubId: selection.subId,
      effectiveCategoryId: effectiveCategoryId(selection),
      childrenOf,
      descendantIds,
      select,
      goUp,
      clear,
    }),
    [categories, isLoading, rootCategories, subRow, selection, childrenOf, descendantIds, select, goUp, clear]
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
};

export const useCategoryContext = (): CategoryContextType => {
  const categoryContext = useContext(CategoryContext);

  if (categoryContext === null) {
    throw new Error('useCategoryContext must be used within CategoryProvider');
  }

  return categoryContext;
};
