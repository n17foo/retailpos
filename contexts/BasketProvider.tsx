import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ImageSourcePropType } from 'react-native';
import { Basket } from '../services/basket/basket';
import { LocalOrder, LocalOrderStatus, CheckoutResult, SyncResult } from '../services/order/order';
import { getServiceContainer, ServiceContainer } from '../services/basket/BasketServiceFactory';
import { ECommercePlatform } from '../utils/platforms';
import { useAuthContext } from './AuthProvider';
import { queueManager } from '../services/queue/QueueManager';

// Re-export basket item type for components
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | ImageSourcePropType | null;
  isEcommerceProduct?: boolean;
  variantId?: string;
  originalId?: string;
  sku?: string;
  platformId?: string;
  platform?: ECommercePlatform;
}

// Product type for cart operations
export interface CartProduct {
  id: string;
  name: string;
  price: number;
  image?: string | ImageSourcePropType | null;
  isEcommerceProduct?: boolean;
  variantId?: string;
  originalId?: string;
  sku?: string;
  taxable?: boolean;
  platformId?: string;
  platform?: ECommercePlatform;
}

// Cart items as a map (productId -> quantity) for efficient lookups
export type CartItemsMap = Record<string, number>;

export interface BasketContextType {
  // Panel state
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: Dispatch<SetStateAction<boolean>>;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // Basket data from service
  basket: Basket | null;

  // Cart items as array (with full product info) - derived from basket
  cartItems: CartItem[];

  // Cart items as map (productId -> quantity) for ProductGrid
  cartItemsMap: CartItemsMap;

  // Cart operations (synced to SQLite)
  addToCart: (product: CartProduct, quantity?: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  incrementQuantity: (itemId: string) => Promise<void>;
  decrementQuantity: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;

  // Customer and discount
  setCustomer: (email?: string, name?: string) => Promise<void>;
  setNote: (note: string) => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: () => Promise<void>;

  // Checkout operations
  currentOrder: LocalOrder | null;
  startCheckout: (platform?: ECommercePlatform) => Promise<LocalOrder | null>;
  markPaymentProcessing: (orderId: string) => Promise<void>;
  completePayment: (orderId: string, paymentMethod: string, transactionId?: string) => Promise<CheckoutResult>;
  cancelOrder: (orderId: string) => Promise<void>;

  // Sync operations
  unsyncedOrdersCount: number;
  syncOrderToPlatform: (orderId: string) => Promise<CheckoutResult>;
  syncAllPendingOrders: () => Promise<SyncResult>;
  getUnsyncedOrders: () => Promise<LocalOrder[]>;
  getLocalOrders: (status?: LocalOrderStatus) => Promise<LocalOrder[]>;

  // Sync queue status
  getSyncQueueStatus: () => { length: number; isProcessing: boolean; pendingRequests: number; retryingRequests: number };

  // Cart totals (from basket)
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;

  // Refresh
  refreshBasket: () => Promise<void>;
}

export const BasketContext = createContext<BasketContextType | null>(null);

export const BasketProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  // Auth context for cashier tracking
  const { user } = useAuthContext();

  // Panel state
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  // Service state
  const [basket, setBasket] = useState<Basket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<LocalOrder | null>(null);
  const [unsyncedOrdersCount, setUnsyncedOrdersCount] = useState(0);

  const containerRef = useRef<ServiceContainer | null>(null);
  const mountedRef = useRef(true);

  // Initialize the services
  useEffect(() => {
    mountedRef.current = true;

    const initService = async () => {
      try {
        const container = await getServiceContainer();
        containerRef.current = container;

        const basketData = await container.basketService.getBasket();
        const unsyncedOrders = await container.checkoutService.getUnsyncedOrders();

        if (mountedRef.current) {
          setBasket(basketData);
          setUnsyncedOrdersCount(unsyncedOrders.length);
          setIsLoading(false);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError((err as Error).message);
          setIsLoading(false);
        }
      }
    };

    initService();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Derive cart items from basket
  const cartItems: CartItem[] = useMemo(() => {
    if (!basket) return [];
    return basket.items.map(item => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      isEcommerceProduct: item.isEcommerceProduct,
      variantId: item.variantId,
      originalId: item.originalId,
      sku: item.sku,
    }));
  }, [basket]);

  // Create a map of productId -> quantity for efficient lookups
  const cartItemsMap = useMemo(() => {
    const map: CartItemsMap = {};
    cartItems.forEach(item => {
      map[item.productId] = item.quantity;
    });
    return map;
  }, [cartItems]);

  // Totals from basket
  const subtotal = basket?.subtotal ?? 0;
  const tax = basket?.tax ?? 0;
  const total = basket?.total ?? 0;
  const itemCount = useMemo(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  // Refresh basket from service
  const refreshBasket = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      const basketData = await containerRef.current.basketService.getBasket();
      if (mountedRef.current) {
        setBasket(basketData);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const refreshUnsyncedCount = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      const unsyncedOrders = await containerRef.current.checkoutService.getUnsyncedOrders();
      if (mountedRef.current) {
        setUnsyncedOrdersCount(unsyncedOrders.length);
      }
    } catch (err) {
      console.error('Failed to refresh unsynced count:', err);
    }
  }, []);

  // Helper to convert ImageSourcePropType to string URL
  const getImageUrl = (image: string | ImageSourcePropType | null | undefined): string | undefined => {
    if (!image) return undefined;
    if (typeof image === 'string') return image;
    if (typeof image === 'object' && 'uri' in image) return image.uri;
    return undefined;
  };

  // Cart operations
  const addToCart = useCallback(async (product: CartProduct, quantity: number = 1) => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.addItem({
        productId: product.id,
        variantId: product.variantId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        quantity,
        image: getImageUrl(product.image),
        taxable: product.taxable ?? true,
        isEcommerceProduct: product.isEcommerceProduct,
        originalId: product.originalId || product.platformId,
      });
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const removeFromCart = useCallback(async (itemId: string) => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.removeItem(itemId);
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.updateItemQuantity(itemId, quantity);
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const incrementQuantity = useCallback(
    async (itemId: string) => {
      const item = cartItems.find(i => i.id === itemId);
      if (item) {
        await updateQuantity(itemId, item.quantity + 1);
      }
    },
    [cartItems, updateQuantity]
  );

  const decrementQuantity = useCallback(
    async (itemId: string) => {
      const item = cartItems.find(i => i.id === itemId);
      if (item) {
        await updateQuantity(itemId, item.quantity - 1);
      }
    },
    [cartItems, updateQuantity]
  );

  const clearCart = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      await containerRef.current.basketService.clearBasket();
      await refreshBasket();
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, [refreshBasket]);

  // Customer and discount operations
  const setCustomer = useCallback(async (email?: string, name?: string) => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.setCustomer(email, name);
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const setNote = useCallback(async (note: string) => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.setNote(note);
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const applyDiscount = useCallback(async (code: string) => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.applyDiscount(code);
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const removeDiscount = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      const newBasket = await containerRef.current.basketService.removeDiscount();
      if (mountedRef.current) {
        setBasket(newBasket);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  // Checkout operations
  const startCheckout = useCallback(
    async (platform?: ECommercePlatform): Promise<LocalOrder | null> => {
      if (!containerRef.current) return null;

      try {
        const order = await containerRef.current.checkoutService.startCheckout(platform, user?.id, user?.username);
        if (mountedRef.current) {
          setCurrentOrder(order);
          setError(null);
        }
        return order;
      } catch (err) {
        if (mountedRef.current) {
          setError((err as Error).message);
        }
        return null;
      }
    },
    [user]
  );

  const markPaymentProcessing = useCallback(async (orderId: string) => {
    if (!containerRef.current) return;

    try {
      const order = await containerRef.current.checkoutService.markPaymentProcessing(orderId);
      if (mountedRef.current) {
        setCurrentOrder(order);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  const completePayment = useCallback(
    async (orderId: string, paymentMethod: string, transactionId?: string): Promise<CheckoutResult> => {
      if (!containerRef.current) {
        return { success: false, orderId, error: 'Service not initialized' };
      }

      try {
        const result = await containerRef.current.checkoutService.completePayment(orderId, paymentMethod, transactionId);

        if (result.success && mountedRef.current) {
          await refreshBasket();
          await refreshUnsyncedCount();
          setCurrentOrder(null);
        }

        return result;
      } catch (err) {
        if (mountedRef.current) {
          setError((err as Error).message);
        }
        return { success: false, orderId, error: (err as Error).message };
      }
    },
    [refreshBasket, refreshUnsyncedCount]
  );

  const cancelOrder = useCallback(async (orderId: string) => {
    if (!containerRef.current) return;

    try {
      await containerRef.current.checkoutService.cancelOrder(orderId);
      if (mountedRef.current) {
        setCurrentOrder(null);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, []);

  // Sync operations
  const syncOrderToPlatform = useCallback(
    async (orderId: string): Promise<CheckoutResult> => {
      if (!containerRef.current) {
        return { success: false, orderId, error: 'Service not initialized' };
      }

      try {
        const result = await containerRef.current.orderSyncService.syncOrderToPlatform(orderId);
        if (result.success) {
          await refreshUnsyncedCount();
        }
        return result;
      } catch (err) {
        return { success: false, orderId, error: (err as Error).message };
      }
    },
    [refreshUnsyncedCount]
  );

  const syncAllPendingOrders = useCallback(async (): Promise<SyncResult> => {
    if (!containerRef.current) {
      return { synced: 0, failed: 0, errors: [] };
    }

    try {
      const result = await containerRef.current.orderSyncService.syncAllPendingOrders();
      await refreshUnsyncedCount();
      return result;
    } catch (err) {
      return { synced: 0, failed: 0, errors: [{ orderId: 'unknown', error: (err as Error).message }] };
    }
  }, [refreshUnsyncedCount]);

  const getUnsyncedOrders = useCallback(async (): Promise<LocalOrder[]> => {
    if (!containerRef.current) return [];
    return containerRef.current.checkoutService.getUnsyncedOrders();
  }, []);

  const getLocalOrders = useCallback(async (status?: LocalOrderStatus): Promise<LocalOrder[]> => {
    if (!containerRef.current) return [];
    return containerRef.current.checkoutService.getLocalOrders(status);
  }, []);

  // Sync queue status
  const getSyncQueueStatus = useCallback(() => {
    return queueManager.getQueueStatus();
  }, []);

  const value = useMemo(
    () => ({
      isRightPanelOpen,
      setIsRightPanelOpen,
      isLoading,
      error,
      basket,
      cartItems,
      cartItemsMap,
      addToCart,
      removeFromCart,
      updateQuantity,
      incrementQuantity,
      decrementQuantity,
      clearCart,
      setCustomer,
      setNote,
      applyDiscount,
      removeDiscount,
      currentOrder,
      startCheckout,
      markPaymentProcessing,
      completePayment,
      cancelOrder,
      unsyncedOrdersCount,
      syncOrderToPlatform,
      syncAllPendingOrders,
      getUnsyncedOrders,
      getLocalOrders,
      getSyncQueueStatus,
      subtotal,
      tax,
      total,
      itemCount,
      refreshBasket,
    }),
    [
      isRightPanelOpen,
      isLoading,
      error,
      basket,
      cartItems,
      cartItemsMap,
      addToCart,
      removeFromCart,
      updateQuantity,
      incrementQuantity,
      decrementQuantity,
      clearCart,
      setCustomer,
      setNote,
      applyDiscount,
      removeDiscount,
      currentOrder,
      startCheckout,
      markPaymentProcessing,
      completePayment,
      cancelOrder,
      unsyncedOrdersCount,
      syncOrderToPlatform,
      syncAllPendingOrders,
      getUnsyncedOrders,
      getLocalOrders,
      getSyncQueueStatus,
      subtotal,
      tax,
      total,
      itemCount,
      refreshBasket,
    ]
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
};

export const useBasketContext = (): BasketContextType => {
  const basketContext = useContext(BasketContext);

  if (basketContext === null) {
    throw new Error('useBasketContext must be used within BasketProvider');
  }

  return basketContext;
};
