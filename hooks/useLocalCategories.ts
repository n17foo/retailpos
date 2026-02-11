import { useState, useEffect, useCallback } from 'react';
import { Category, CategoryRepository } from '../repositories/CategoryRepository';

const categoryRepository = new CategoryRepository();

export const useLocalCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const allCategories = await categoryRepository.findAll();
      setCategories(allCategories);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await categoryRepository.create(categoryData);
      await fetchCategories();
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const updateCategory = async (id: string, categoryData: Partial<Category>) => {
    try {
      await categoryRepository.update(id, categoryData);
      await fetchCategories();
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await categoryRepository.delete(id);
      await fetchCategories();
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
  };
};
