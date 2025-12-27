import React, { createContext, useContext, ReactNode } from 'react';
import { useLocalProducts } from '../hooks/useLocalProducts';
import { useOrders } from '../hooks/useOrders';
import { Product } from '../repositories/ProductRepository';
import { OrderWithItems } from '../hooks/useOrders';
import { Order } from '../repositories/OrderRepository';
import { OrderItem } from '../repositories/OrderItemRepository';

interface DataContextType {
  products: Product[];
  productLoading: boolean;
  productError: Error | null;
  fetchProducts: () => Promise<void>;
  addProduct: (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProduct: (id: string, productData: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  orders: OrderWithItems[];
  orderLoading: boolean;
  orderError: Error | null;
  fetchOrders: () => Promise<void>;
  addOrder: (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at'>, items: Omit<OrderItem, 'id' | 'order_id'>[]) => Promise<void>;
  updateOrder: (id: string, orderData: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    products,
    loading: productLoading,
    error: productError,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useLocalProducts();

  const { orders, loading: orderLoading, error: orderError, fetchOrders, addOrder, updateOrder, deleteOrder } = useOrders();

  const value = {
    products,
    productLoading,
    productError,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    orders,
    orderLoading,
    orderError,
    fetchOrders,
    addOrder,
    updateOrder,
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
