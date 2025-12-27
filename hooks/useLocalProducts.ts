import { useState, useEffect, useCallback } from 'react';
import { Product, ProductRepository } from '../repositories/ProductRepository';

const productRepository = new ProductRepository();

export const useLocalProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const allProducts = await productRepository.findAll();
      setProducts(allProducts);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await productRepository.create(productData);
      await fetchProducts(); // Refresh the list
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      await productRepository.update(id, productData);
      await fetchProducts(); // Refresh the list
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productRepository.delete(id);
      await fetchProducts(); // Refresh the list
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
  };
};
