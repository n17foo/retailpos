import { useCallback } from 'react';
import type { DisplayProduct } from '../services/product/displayProduct';
import type { UnifiedProductVariant } from '../services/product/types';
import { notificationService } from '../services/notifications/NotificationService';
import { getAvailableQuantity, isVariantSellable } from '../utils/sellability';
import { useBasketState } from '../contexts/BasketStateProvider';
import { BasketProduct, useBasketActions } from '../contexts/BasketActionsProvider';

/** Builds "Size: M / Color: Red" (or the variant title) so lines for different variants are distinguishable */
const getOptionSummary = (product: DisplayProduct, variant: UnifiedProductVariant | undefined): string | undefined => {
  if (!variant) return undefined;
  if (variant.optionValues.length > 0) {
    const options = product.options ?? [];
    return variant.optionValues
      .map((value, index) => (options[index] ? `${options[index].name}: ${value}` : value))
      .filter(Boolean)
      .join(' / ');
  }
  return variant.title && variant.title !== 'Default' ? variant.title : undefined;
};

const findVariant = (product: DisplayProduct, variantId: string | undefined): UnifiedProductVariant | undefined => {
  const id = variantId ?? product.variantId;
  return id && product.variants ? product.variants.find(v => v.id === id) : undefined;
};

/** Sellability and remaining stock for a product (or one of its variants), from the shared rule */
export const getAvailability = (product: DisplayProduct, variantId?: string): { sellable: boolean; available: number | undefined } => {
  const variant = findVariant(product, variantId);
  if (product.variants) {
    return variant
      ? { sellable: isVariantSellable(variant), available: getAvailableQuantity(variant) }
      : { sellable: product.sellable, available: undefined };
  }
  return { sellable: product.sellable, available: product.stock };
};

export const toBasketProduct = (product: DisplayProduct, variantId?: string): BasketProduct => {
  const variant = findVariant(product, variantId);
  return {
    id: product.id,
    name: product.name,
    optionSummary: getOptionSummary(product, variant),
    // The chosen variant's own price/SKU/tax code, not the product default
    price: variant?.price ?? product.price,
    image: product.image,
    isEcommerceProduct: product.isEcommerceProduct,
    variantId: variantId ?? product.variantId,
    sku: variant?.sku ?? product.sku,
    platformId: product.platformId,
    platform: product.platform,
    taxProfileId: product.taxProfileId,
    taxCode: variant?.taxCode ?? product.taxCode,
    taxable: variant?.taxable ?? product.taxable,
  };
};

export const sameVariant = (a: string | undefined, b: string | undefined) => (a ?? undefined) === (b ?? undefined);

/**
 * The one way to add a unit of a product to the basket (tile, variant picker, scan, search).
 * Enforces the shared stock rules: out-of-stock items are never added and quantity never exceeds
 * the tracked stock. Returns whether the unit was added.
 */
export const useAddToBasket = () => {
  const { basketItems } = useBasketState();
  const { addToBasket } = useBasketActions();

  return useCallback(
    async (product: DisplayProduct, variantId?: string): Promise<boolean> => {
      const { sellable, available } = getAvailability(product, variantId);
      if (!sellable) {
        notificationService.notify('Out of stock', `${product.name} is out of stock`, 'warning');
        return false;
      }
      const line = basketItems.find(i => i.productId === product.id && sameVariant(i.variantId, variantId ?? product.variantId));
      if (available !== undefined && (line?.quantity ?? 0) + 1 > available) {
        notificationService.notify('Stock limit', `Only ${available} available for ${product.name}`, 'warning');
        return false;
      }
      await addToBasket(toBasketProduct(product, variantId), 1);
      return true;
    },
    [basketItems, addToBasket]
  );
};
