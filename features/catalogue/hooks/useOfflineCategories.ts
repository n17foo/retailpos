import { useState, useCallback, useEffect } from 'react';
import { Category } from '../services/category/CategoryServiceInterface';
import { offlineCategoryService } from '../services/category/platforms/OfflineCategoryService';
import { instoreApiCategoryService } from '../services/category/platforms/InstoreApiCategoryService';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { useLogger } from '../../../shared/hooks/useLogger';

interface UseOfflineCategoriesReturn {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  loadCategories: () => Promise<void>;
  createCategory: (category: Omit<Category, 'id'>) => Promise<Category>;
  updateCategory: (id: string, data: Partial<Category>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<boolean>;
  clearAllCategories: () => Promise<void>;
  setCategories: (categories: Category[]) => Promise<void>;
}

/**
 * Local-catalogue category service: Store API in multi-register client mode,
 * per-device KV otherwise. Resolved at call time.
 */
const getLocalCategoryService = () => (instoreApiConfig.isClient ? instoreApiCategoryService : offlineCategoryService);

export const useOfflineCategories = (): UseOfflineCategoriesReturn => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logger = useLogger('useOfflineCategories');

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLocalCategoryService().getCategories();
      setCategories(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
      logger.error({ message: 'Error loading categories' }, err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  const createCategory = useCallback(
    async (categoryData: Omit<Category, 'id'>): Promise<Category> => {
      setIsLoading(true);
      setError(null);
      try {
        const newCategory = await getLocalCategoryService().addCategory(categoryData);
        await loadCategories();
        return newCategory;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create category';
        setError(message);
        throw new Error(message, { cause: err });
      } finally {
        setIsLoading(false);
      }
    },
    [loadCategories]
  );

  const updateCategory = useCallback(
    async (id: string, data: Partial<Category>): Promise<Category> => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await getLocalCategoryService().updateCategory(id, data);
        await loadCategories();
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update category';
        setError(message);
        throw new Error(message, { cause: err });
      } finally {
        setIsLoading(false);
      }
    },
    [loadCategories]
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await getLocalCategoryService().deleteCategory(id);
        await loadCategories();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete category');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadCategories]
  );

  const clearAllCategories = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await getLocalCategoryService().clearLocalCategories();
      setCategories([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCategoriesFromExternal = useCallback(
    async (newCategories: Category[]): Promise<void> => {
      setIsLoading(true);
      try {
        await getLocalCategoryService().setCategories(newCategories);
        await loadCategories();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set categories');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadCategories]
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    isLoading,
    error,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    clearAllCategories,
    setCategories: setCategoriesFromExternal,
  };
};

export type { Category };
