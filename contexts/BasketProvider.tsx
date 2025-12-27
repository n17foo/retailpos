import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ImageSourcePropType } from 'react-native';
import {
  BasketItem as ServiceBasketItem,
  Basket,
  LocalOrder,
  LocalOrderStatus,
  CheckoutResult,
  SyncResult,
} from '../services/basket/BasketServiceInterface';
import { getBasketService } from '../services/basket/basketServiceFactory';
import { BasketServiceInterface } from '../services/basket/BasketServiceInterface';
import { ECommercePlatform } from '../utils/platforms';

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
  // Panel state
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

  // Service state
  const [basket, setBasket] = useState<Basket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<LocalOrder | null>(null);
  const [unsyncedOrdersCount, setUnsyncedOrdersCount] = useState(0);

  const serviceRef = useRef<BasketServiceInterface | null>(null);
  const mountedRef = useRef(true);

  // Initialize the service
  useEffect(() => {
    mountedRef.current = true;

    const initService = async () => {
      try {
        const service = await getBasketService();
        await service.initialize(); // Initialize the service (database connection)
        serviceRef.current = service;

        const basketData = await service.getBasket();
        const unsyncedOrders = await service.getUnsyncedOrders();

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
    if (!serviceRef.current) return;

    try {
      const basketData = await serviceRef.current.getBasket();
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
    if (!serviceRef.current) return;

    try {
      const unsyncedOrders = await serviceRef.current.getUnsyncedOrders();
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
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.addItem({
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
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.removeItem(itemId);
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
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.updateItemQuantity(itemId, quantity);
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
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.clearBasket();
      await refreshBasket();
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    }
  }, [refreshBasket]);

  // Customer and discount operations
  const setCustomer = useCallback(async (email?: string, name?: string) => {
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.setCustomer(email, name);
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
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.setNote(note);
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
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.applyDiscount(code);
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
    if (!serviceRef.current) return;

    try {
      const newBasket = await serviceRef.current.removeDiscount();
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
  const startCheckout = useCallback(async (platform?: ECommercePlatform): Promise<LocalOrder | null> => {
    if (!serviceRef.current) return null;

    try {
      const order = await serviceRef.current.startCheckout(platform);
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
  }, []);

  const markPaymentProcessing = useCallback(async (orderId: string) => {
    if (!serviceRef.current) return;

    try {
      const order = await serviceRef.current.markPaymentProcessing(orderId);
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
      if (!serviceRef.current) {
        return { success: false, orderId, error: 'Service not initialized' };
      }

      try {
        const result = await serviceRef.current.completePayment(orderId, paymentMethod, transactionId);

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
    if (!serviceRef.current) return;

    try {
      await serviceRef.current.cancelOrder(orderId);
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
      if (!serviceRef.current) {
        return { success: false, orderId, error: 'Service not initialized' };
      }

      try {
        const result = await serviceRef.current.syncOrderToPlatform(orderId);
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
    if (!serviceRef.current) {
      return { synced: 0, failed: 0, errors: [] };
    }

    try {
      const result = await serviceRef.current.syncAllPendingOrders();
      await refreshUnsyncedCount();
      return result;
    } catch (err) {
      return { synced: 0, failed: 0, errors: [{ orderId: 'unknown', error: (err as Error).message }] };
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
