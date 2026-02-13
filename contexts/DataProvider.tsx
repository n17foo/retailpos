import React, { createContext, useContext, ReactNode } from 'react';
import { useOrders, OrderWithItems } from '../hooks/useOrders';
import { useOfflineProducts } from '../hooks/useOfflineProducts';
import { useOfflineCategories } from '../hooks/useOfflineCategories';
import { Product } from '../services/product/ProductServiceInterface';
import { Category } from '../services/category/CategoryServiceInterface';

interface DataContextType {
  products: Product[];
  productLoading: boolean;
  productError: string | null;
  loadProducts: () => Promise<void>;
  createProduct: (productData: any) => Promise<Product>;
  updateProduct: (id: string, productData: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<boolean>;

  categories: Category[];
  categoryLoading: boolean;
  categoryError: string | null;
  loadCategories: () => Promise<void>;
  createCategory: (categoryData: any) => Promise<Category>;
  updateCategory: (id: string, categoryData: Partial<Category>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<boolean>;

  orders: OrderWithItems[];
  orderLoading: boolean;
  orderError: Error | null;
  fetchOrders: () => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    products,
    isLoading: productLoading,
    error: productError,
    loadProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useOfflineProducts();

  const {
    categories,
    isLoading: categoryLoading,
    error: categoryError,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useOfflineCategories();

  const { orders, loading: orderLoading, error: orderError, fetchOrders, deleteOrder } = useOrders();

  const value: DataContextType = {
    products,
    productLoading,
    productError,
    loadProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    categories,
    categoryLoading,
    categoryError,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    orders,
    orderLoading,
    orderError,
    fetchOrders,
    deleteOrder,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
