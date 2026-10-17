import React, { ReactNode, createContext, useContext, useMemo, useCallback } from 'react';
import { ImageSourcePropType } from 'react-native';
import { ECommercePlatform } from '../utils/platforms';
import { useBasketState } from './BasketStateProvider';
import { customerDisplayServiceFactory } from '../services/display/CustomerDisplayServiceFactory';
import { buildDisplayState } from '../services/display/CustomerDisplayServiceInterface';
import { useCurrency } from '../hooks/useCurrency';

// Logger for debugging (can be used for future error tracking)
// const logger = LoggerFactory.getInstance().createLogger('BasketActionsContext');

// Product type for basket operations
export interface BasketProduct {
  id: string;
  name: string;
  price: number;
  image?: string | ImageSourcePropType | null;
  isEcommerceProduct?: boolean;
  variantId?: string;
  /** Human-readable option summary, e.g. "Size: M / Color: Red" */
  optionSummary?: string;
  originalId?: string;
  sku?: string;
  taxable?: boolean;
  taxRate?: number;
  taxProfileId?: string;
  taxCode?: string;
  platformId?: string;
  platform?: ECommercePlatform;
}

export interface BasketActionsContextType {
  // Basket operations (synced to SQLite)
  addToBasket: (product: BasketProduct, quantity?: number) => Promise<void>;
  removeFromBasket: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  incrementQuantity: (itemId: string) => Promise<void>;
  decrementQuantity: (itemId: string) => Promise<void>;
  clearBasket: () => Promise<void>;

  // Customer and discount
  setCustomer: (email?: string, name?: string) => Promise<void>;
  setNote: (note: string) => Promise<void>;
  setSaleMode: (mode: string | undefined) => Promise<void>;
  /** Merge properties onto one basket line (line note, sale-mode marker, …) */
  setLineProperties: (itemId: string, properties: Record<string, string>) => Promise<void>;
  applyDiscount: (code: string) => Promise<void>;
  removeDiscount: () => Promise<void>;

  // Refresh
  refreshBasket: () => Promise<void>;
}

export const BasketActionsContext = createContext<BasketActionsContextType | null>(null);

export const BasketActionsProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const state = useBasketState();
  const currency = useCurrency();

  // Helper to convert ImageSourcePropType to string URL
  const getImageUrl = useCallback((image: string | ImageSourcePropType | null | undefined): string | undefined => {
    if (!image) return undefined;
    if (typeof image === 'string') return image;
    if (typeof image === 'object' && 'uri' in image) return image.uri;
    return undefined;
  }, []);

  // Refresh basket from service
  const refreshBasket = useCallback(async () => {
    if (!state._containerRef.current) return;

    try {
      const basketData = await state._containerRef.current.basketService.getBasket();
      if (state._mountedRef.current) {
        state._setBasket(basketData);
        state._setError(null);
      }
    } catch (err) {
      if (state._mountedRef.current) {
        state._setError((err as Error).message);
      }
    }
  }, [state]);

  // Push basket state to customer-facing display on every change
  React.useEffect(() => {
    const display = customerDisplayServiceFactory.getService();
    if (!display.isConnected()) return;
    if (state.basketItems.length === 0) {
      display.showIdle().catch(() => {});
    } else {
      const basketItems = state.basketItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));
      display.update(buildDisplayState(basketItems, state.subtotal, state.tax, state.total, currency.code, 'basket')).catch(() => {});
    }
  }, [state.basketItems, state.subtotal, state.tax, state.total, currency.code]);

  // Cart operations - all wrapped in useCallback for stability
  const addToBasket = useCallback(
    async (product: BasketProduct, quantity: number = 1) => {
      if (!state._containerRef.current) return;

      try {
        // Spec requirement 2.11: tax rate at add-to-cart time. Only the offline catalogue uses local tax setup.
        // Online platforms own tax: the line carries no rate and the platform calculates tax for the whole
        // basket at checkout (draft order / quote), so nothing is looked up or assumed per product here.
        let resolvedTaxRate = product.taxRate;

        if (resolvedTaxRate === undefined && (product.platform ?? ECommercePlatform.OFFLINE) === ECommercePlatform.OFFLINE) {
          const { resolveOfflineTaxRate } = await import('../services/tax/OfflineTaxResolver');
          resolvedTaxRate = await resolveOfflineTaxRate(product.taxProfileId);
        }

        const newBasket = await state._containerRef.current.basketService.addItem({
          productId: product.id,
          variantId: product.variantId,
          sku: product.sku,
          name: product.name,
          optionSummary: product.optionSummary,
          price: product.price,
          quantity,
          image: getImageUrl(product.image),
          isEcommerceProduct: product.isEcommerceProduct,
          originalId: product.originalId || product.platformId,
          taxRate: resolvedTaxRate,
          taxable: product.taxable ?? true,
          inventoryPolicy: 'deny',
        });
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state, getImageUrl]
  );

  const removeFromBasket = useCallback(
    async (itemId: string) => {
      if (!state._containerRef.current) return;

      try {
        const newBasket = await state._containerRef.current.basketService.removeItem(itemId);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (!state._containerRef.current) return;

      try {
        const newBasket = await state._containerRef.current.basketService.updateItemQuantity(itemId, quantity);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const incrementQuantity = useCallback(
    async (itemId: string) => {
      const item = state.basketItems.find(i => i.id === itemId);
      if (item) {
        await updateQuantity(itemId, item.quantity + 1);
      }
    },
    [state.basketItems, updateQuantity]
  );

  const decrementQuantity = useCallback(
    async (itemId: string) => {
      const item = state.basketItems.find(i => i.id === itemId);
      if (item) {
        await updateQuantity(itemId, item.quantity - 1);
      }
    },
    [state.basketItems, updateQuantity]
  );

  const clearBasket = useCallback(async () => {
    if (!state._containerRef.current) return;

    try {
      await state._containerRef.current.basketService.clearBasket();
      await refreshBasket();
    } catch (err) {
      if (state._mountedRef.current) {
        state._setError((err as Error).message);
      }
    }
  }, [state, refreshBasket]);

  // Customer and discount operations
  const setCustomer = useCallback(
    async (email?: string, name?: string) => {
      if (!state._containerRef.current) return;

      try {
        const newBasket = await state._containerRef.current.basketService.setCustomer(email, name);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const setNote = useCallback(
    async (note: string) => {
      if (!state._containerRef.current) return;

      try {
        const newBasket = await state._containerRef.current.basketService.setNote(note);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const setSaleMode = useCallback(
    async (mode: string | undefined) => {
      if (!state._containerRef.current) return;
      try {
        const newBasket = await state._containerRef.current.basketService.setSaleMode(mode);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const setLineProperties = useCallback(
    async (itemId: string, properties: Record<string, string>) => {
      if (!state._containerRef.current) return;
      try {
        const newBasket = await state._containerRef.current.basketService.updateItemProperties(itemId, properties);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const applyDiscount = useCallback(
    async (code: string) => {
      if (!state._containerRef.current) return;

      try {
        const newBasket = await state._containerRef.current.basketService.applyDiscount(code);
        if (state._mountedRef.current) {
          state._setBasket(newBasket);
          state._setError(null);
        }
      } catch (err) {
        if (state._mountedRef.current) {
          state._setError((err as Error).message);
        }
      }
    },
    [state]
  );

  const removeDiscount = useCallback(async () => {
    if (!state._containerRef.current) return;

    try {
      const newBasket = await state._containerRef.current.basketService.removeDiscount();
      if (state._mountedRef.current) {
        state._setBasket(newBasket);
        state._setError(null);
      }
    } catch (err) {
      if (state._mountedRef.current) {
        state._setError((err as Error).message);
      }
    }
  }, [state]);

  // Memoize the entire context value - these callbacks are stable
  const value = useMemo(
    () => ({
      addToBasket,
      removeFromBasket,
      updateQuantity,
      incrementQuantity,
      decrementQuantity,
      clearBasket,
      setCustomer,
      setNote,
      setSaleMode,
      setLineProperties,
      applyDiscount,
      removeDiscount,
      refreshBasket,
    }),
    [
      addToBasket,
      removeFromBasket,
      updateQuantity,
      incrementQuantity,
      decrementQuantity,
      clearBasket,
      setCustomer,
      setNote,
      setSaleMode,
      setLineProperties,
      applyDiscount,
      removeDiscount,
      refreshBasket,
    ]
  );

  return <BasketActionsContext.Provider value={value}>{children}</BasketActionsContext.Provider>;
};

export const useBasketActions = (): BasketActionsContextType => {
  const context = useContext(BasketActionsContext);
  if (context === null) {
    throw new Error('useBasketActions must be used within BasketActionsProvider');
  }
  return context;
};
