import React, { ReactNode, createContext, useContext } from 'react';
import { useSaleScreen } from '../hooks/useSaleScreen';

export type SaleContextType = ReturnType<typeof useSaleScreen>;

const SaleContext = createContext<SaleContextType | null>(null);

/**
 * Runs the sale-screen logic exactly once and shares it with every sale component
 * (catalogue, categories, basket). Must be rendered inside the Sale route.
 */
export const SaleProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const value = useSaleScreen();
  return <SaleContext.Provider value={value}>{children}</SaleContext.Provider>;
};

export const useSale = (): SaleContextType => {
  const context = useContext(SaleContext);
  if (context === null) {
    throw new Error('useSale must be used within SaleProvider');
  }
  return context;
};
