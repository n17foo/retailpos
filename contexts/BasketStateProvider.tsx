import React, { ReactNode, createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { ImageSourcePropType } from 'react-native';
import { Basket } from '../services/basket/basket';
import { LocalOrder } from '../services/order/order';
import { getServiceContainer, ServiceContainer } from '../services/basket/BasketServiceFactory';
import { syncEventBus } from '../services/instoreapi/sync/SyncEventBus';
import { instoreApiConfig } from '../services/instoreapi/InstoreApiConfig';

// Re-export basket item type for components
export interface BasketItem {
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
  /** Human-readable option summary, e.g. "Size: M / Color: Red" */
  optionSummary?: string;
  /** Line properties (e.g. a per-line note) — persisted in the items JSON */
  properties?: Record<string, string>;
}

// Cart items as a map (productId -> quantity) for efficient lookups
export type BasketItemsMap = Record<string, number>;

/**
 * BasketStateContext - Fast-changing state (updates on every cart action)
 * Separated from actions to minimize re-renders
 */
export interface BasketStateContextType {
  // Loading state
  isLoading: boolean;
  error: string | null;

  // Basket data from service
  basket: Basket | null;

  // Cart items as array (with full product info) - derived from basket
  basketItems: BasketItem[];

  // Cart items as map (productId -> quantity) for ProductGrid
  basketItemsMap: BasketItemsMap;

  // Cart totals (from basket)
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;

  // Current order state
  currentOrder: LocalOrder | null;

  // Unsynced orders count
  unsyncedOrdersCount: number;

  // Internal: service container ref for actions context
  _containerRef: React.MutableRefObject<ServiceContainer | null>;
  _mountedRef: React.MutableRefObject<boolean>;
  _setBasket: React.Dispatch<React.SetStateAction<Basket | null>>;
  _setError: React.Dispatch<React.SetStateAction<string | null>>;
  _setCurrentOrder: React.Dispatch<React.SetStateAction<LocalOrder | null>>;
  _setUnsyncedOrdersCount: React.Dispatch<React.SetStateAction<number>>;
}

export const BasketStateContext = createContext<BasketStateContextType | null>(null);

export const BasketStateProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
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

  // Derive basket items from basket - memoized efficiently
  const basketItems: BasketItem[] = useMemo(() => {
    if (!basket?.items) return [];
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
      optionSummary: item.optionSummary,
      properties: item.properties,
    }));
  }, [basket?.items]);

  // Create a map of productId -> quantity for efficient lookups
  // Optimized: directly from basket items, skip intermediate array
  const basketItemsMap = useMemo(() => {
    if (!basket?.items) return {};
    return basket.items.reduce((acc, item) => {
      acc[item.productId] = (acc[item.productId] ?? 0) + item.quantity;
      return acc;
    }, {} as BasketItemsMap);
  }, [basket?.items]);

  // Totals from basket
  const subtotal = basket?.subtotal ?? 0;
  const tax = basket?.tax ?? 0;
  const total = basket?.total ?? 0;

  // Optimized: direct calculation from basket items
  const itemCount = useMemo(() => {
    if (!basket?.items) return 0;
    return basket.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [basket?.items]);

  // Subscribe to sync events for real-time updates (spec: multi-register.md §2.7.1-2.7.5)
  useEffect(() => {
    if (!instoreApiConfig.isClient) {
      return; // Only client registers need to listen for server events
    }

    // Refresh basket when inventory is updated on other registers
    const refreshBasket = async () => {
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
    };

    const unsubscribeInventoryUpdated = syncEventBus.on('inventory:updated', () => {
      refreshBasket();
    });

    return () => {
      unsubscribeInventoryUpdated();
    };
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      error,
      basket,
      basketItems,
      basketItemsMap,
      subtotal,
      tax,
      total,
      itemCount,
      currentOrder,
      unsyncedOrdersCount,
      // Internal refs for actions context
      _containerRef: containerRef,
      _mountedRef: mountedRef,
      _setBasket: setBasket,
      _setError: setError,
      _setCurrentOrder: setCurrentOrder,
      _setUnsyncedOrdersCount: setUnsyncedOrdersCount,
    }),
    [isLoading, error, basket, basketItems, basketItemsMap, subtotal, tax, total, itemCount, currentOrder, unsyncedOrdersCount]
  );

  return <BasketStateContext.Provider value={value}>{children}</BasketStateContext.Provider>;
};

export const useBasketState = (): BasketStateContextType => {
  const context = useContext(BasketStateContext);
  if (context === null) {
    throw new Error('useBasketState must be used within BasketStateProvider');
  }
  return context;
};
