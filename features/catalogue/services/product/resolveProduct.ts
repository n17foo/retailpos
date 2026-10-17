import { ECommercePlatform } from '../../../../shared/utils/platforms';
import { ProductServiceFactory } from './ProductServiceFactory';
import { mapToUnifiedProducts } from './mappers';
import { toDisplayProduct, type DisplayProduct } from './displayProduct';

/**
 * Loads one product by id from the platform service and returns it display-ready
 * (variants, stock, tax data). Accepts either the platform id or the app id (`<platform>-<id>`).
 * Used by scan and search, whose results are not guaranteed to be on the loaded grid page.
 */
export const resolveDisplayProduct = async (platform: ECommercePlatform, productId: string): Promise<DisplayProduct | undefined> => {
  const prefix = `${platform}-`;
  const rawId = productId.startsWith(prefix) ? productId.slice(prefix.length) : productId;
  try {
    const service = ProductServiceFactory.getInstance().getService(platform);
    const result = await service.getProducts({ ids: [rawId], limit: 1, includeOutOfStock: true });
    const [unified] = mapToUnifiedProducts(result.products.slice(0, 1), platform);
    return unified ? toDisplayProduct(unified) : undefined;
  } catch {
    return undefined;
  }
};
