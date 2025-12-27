import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BasketServiceInterface,
  Basket,
  BasketItem,
  LocalOrder,
  LocalOrderStatus,
  CheckoutResult,
  SyncResult,
} from '../services/basket/BasketServiceInterface';
import { getBasketService } from '../services/basket/basketServiceFactory';
import { ECommercePlatform } from '../utils/platforms';

interface UseBasketServiceState {
  basket: Basket | null;
  isLoading: boolean;
  error: string | null;
  currentOrder: LocalOrder | null;
  unsyncedOrdersCount: number;
}

interface UseBasketServiceReturn extends UseBasketServiceState {
  // Basket operations
  addItem: (item: Omit<BasketItem, 'id'>) => Promise<void>;
  updateItemQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearBasket: () => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: () => Promise<void>;
  setCustomer: (email?: string, name?: string) => Promise<void>;
  setNote: (note: string) => Promise<void>;
  
  // Checkout operations
  startCheckout: (platform?: ECommercePlatform) => Promise<LocalOrder | null>;
  markPaymentProcessing: (orderId: string) => Promise<void>;
  completePayment: (orderId: string, paymentMethod: string, transactionId?: string) => Promise<CheckoutResult>;
  cancelOrder: (orderId: string) => Promise<void>;
  
  // Sync operations
  syncOrderToPlatform: (orderId: string) => Promise<CheckoutResult>;
  syncAllPendingOrders: () => Promise<SyncResult>;
  getUnsyncedOrders: () => Promise<LocalOrder[]>;
  getLocalOrders: (status?: LocalOrderStatus) => Promise<LocalOrder[]>;
  
  // Refresh
  refreshBasket: () => Promise<void>;
  refreshUnsyncedCount: () => Promise<void>;
}

/**
 * React hook for interacting with the basket service
 * Provides a reactive interface to basket operations
 */
export function useBasketService(): UseBasketServiceReturn {
  const [state, setState] = useState<UseBasketServiceState>({
    basket: null,
    isLoading: true,
    error: null,
    currentOrder: null,
    unsyncedOrdersCount: 0,
  });

  const serviceRef = useRef<BasketServiceInterface | null>(null);
  const mountedRef = useRef(true);

  // Initialize the service
  useEffect(() => {
    mountedRef.current = true;
    
    const initService = async () => {
      try {
        const service = await getBasketService();
        serviceRef.current = service;
        
        const basket = await service.getBasket();
        const unsyncedOrders = await service.getUnsyncedOrders();
        
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            basket,
            unsyncedOrdersCount: unsyncedOrders.length,
            isLoading: false,
          }));
        }
      } catch (error) {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            error: (error as Error).message,
            isLoading: false,
          }));
        }
      }
    };

    initService();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshBasket = useCallback(async () => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.getBasket();
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const refreshUnsyncedCount = useCallback(async () => {
    if (!serviceRef.current) return;
    
    try {
      const unsyncedOrders = await serviceRef.current.getUnsyncedOrders();
      if (mountedRef.current) {
        setState(prev => ({ ...prev, unsyncedOrdersCount: unsyncedOrders.length }));
      }
    } catch (error) {
      console.error('Failed to refresh unsynced count:', error);
    }
  }, []);

  // Basket operations
  const addItem = useCallback(async (item: Omit<BasketItem, 'id'>) => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.addItem(item);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const updateItemQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.updateItemQuantity(itemId, quantity);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const removeItem = useCallback(async (itemId: string) => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.removeItem(itemId);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const clearBasket = useCallback(async () => {
    if (!serviceRef.current) return;
    
    try {
      await serviceRef.current.clearBasket();
      await refreshBasket();
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, [refreshBasket]);

  const applyDiscount = useCallback(async (code: string) => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.applyDiscount(code);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const removeDiscount = useCallback(async () => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.removeDiscount();
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const setCustomer = useCallback(async (email?: string, name?: string) => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.setCustomer(email, name);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const setNote = useCallback(async (note: string) => {
    if (!serviceRef.current) return;
    
    try {
      const basket = await serviceRef.current.setNote(note);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, basket, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  // Checkout operations
  const startCheckout = useCallback(async (platform?: ECommercePlatform): Promise<LocalOrder | null> => {
    if (!serviceRef.current) return null;
    
    try {
      const order = await serviceRef.current.startCheckout(platform);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, currentOrder: order, error: null }));
      }
      return order;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
      return null;
    }
  }, []);

  const markPaymentProcessing = useCallback(async (orderId: string) => {
    if (!serviceRef.current) return;
    
    try {
      const order = await serviceRef.current.markPaymentProcessing(orderId);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, currentOrder: order, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  const completePayment = useCallback(async (
    orderId: string,
    paymentMethod: string,
    transactionId?: string
  ): Promise<CheckoutResult> => {
    if (!serviceRef.current) {
      return { success: false, orderId, error: 'Service not initialized' };
    }
    
    try {
      const result = await serviceRef.current.completePayment(orderId, paymentMethod, transactionId);
      
      if (result.success && mountedRef.current) {
        // Refresh basket and unsynced count after successful payment
        await refreshBasket();
        await refreshUnsyncedCount();
        setState(prev => ({ ...prev, currentOrder: null }));
      }
      
      return result;
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
      return { success: false, orderId, error: (error as Error).message };
    }
  }, [refreshBasket, refreshUnsyncedCount]);

  const cancelOrder = useCallback(async (orderId: string) => {
    if (!serviceRef.current) return;
    
    try {
      await serviceRef.current.cancelOrder(orderId);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, currentOrder: null, error: null }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: (error as Error).message }));
      }
    }
  }, []);

  // Sync operations
  const syncOrderToPlatform = useCallback(async (orderId: string): Promise<CheckoutResult> => {
    if (!serviceRef.current) {
      return { success: false, orderId, error: 'Service not initialized' };
    }
    
    try {
      const result = await serviceRef.current.syncOrderToPlatform(orderId);
      if (result.success) {
        await refreshUnsyncedCount();
      }
      return result;
    } catch (error) {
      return { success: false, orderId, error: (error as Error).message };
    }
  }, [refreshUnsyncedCount]);

  const syncAllPendingOrders = useCallback(async (): Promise<SyncResult> => {
    if (!serviceRef.current) {
      return { synced: 0, failed: 0, errors: [] };
    }
    
    try {
      const result = await serviceRef.current.syncAllPendingOrders();
      await refreshUnsyncedCount();
      return result;
    } catch (error) {
      return { synced: 0, failed: 0, errors: [{ orderId: 'unknown', error: (error as Error).message }] };
    }
  }, [refreshUnsyncedCount]);

  const getUnsyncedOrders = useCallback(async (): Promise<LocalOrder[]> => {
    if (!serviceRef.current) return [];
    return serviceRef.current.getUnsyncedOrders();
  }, []);

  const getLocalOrders = useCallback(async (status?: LocalOrderStatus): Promise<LocalOrder[]> => {
    if (!serviceRef.current) return [];
    return serviceRef.current.getLocalOrders(status);
  }, []);

  return {
    ...state,
    addItem,
    updateItemQuantity,
    removeItem,
    clearBasket,
    applyDiscount,
    removeDiscount,
    setCustomer,
    setNote,
    startCheckout,
    markPaymentProcessing,
    completePayment,
    cancelOrder,
    syncOrderToPlatform,
    syncAllPendingOrders,
    getUnsyncedOrders,
    getLocalOrders,
    refreshBasket,
    refreshUnsyncedCount,
  };
}
