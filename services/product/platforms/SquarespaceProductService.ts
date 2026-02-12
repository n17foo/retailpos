import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';

// Squarespace API version
const SQUARESPACE_API_VERSION = '1.0';

/**
 * Squarespace Commerce implementation of the product service
 * Uses Squarespace Commerce APIs
 */
export class SquarespaceProductService extends BaseProductService {
  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('SquarespaceProductService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.config.apiKey = this.config.apiKey || process.env.SQUARESPACE_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.SQUARESPACE_SITE_ID || '';
      this.config.apiVersion = this.config.apiVersion || process.env.SQUARESPACE_API_VERSION || SQUARESPACE_API_VERSION;

      if (!this.config.apiKey) {
        this.logger.warn('Missing Squarespace API configuration');
        return false;
      }

      await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SQUARESPACE);

      // Test connection
      try {
        const apiUrl = `https://api.squarespace.com/${this.config.apiVersion}/commerce/products?cursor=`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          this.logger.error({ message: 'Failed to connect to Squarespace API' }, new Error(`Status: ${response.status}`));
          return false;
        }
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Squarespace API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Squarespace product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey'],
      optional: ['siteId', 'apiVersion'],
      description: 'Squarespace requires an API key for authentication',
    };
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
      try {
        // Squarespace uses cursor-based pagination
        const cursor = options.cursor || '';
        const apiUrl = `https://api.squarespace.com/${this.config.apiVersion}/commerce/products?cursor=${cursor}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from Squarespace: ${response.statusText}`);
        }

        const data = await response.json();
        const products = (data.products || []).map((p: any) => this.mapToProduct(p));

        // Filter by search if provided (client-side since Squarespace doesn't have search)
        let filteredProducts = products;
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          filteredProducts = products.filter(
            (p: Product) => p.title.toLowerCase().includes(searchLower) || p.description?.toLowerCase().includes(searchLower)
          );
        }

        // Filter by IDs if provided
        if (options.ids && options.ids.length > 0) {
          filteredProducts = filteredProducts.filter((p: Product) => options.ids!.includes(p.id));
        }

        return {
          products: filteredProducts,
          pagination: {
            currentPage: options.page || 1,
            totalPages: data.pagination?.hasNextPage ? (options.page || 1) + 1 : options.page || 1,
            totalItems: filteredProducts.length,
            perPage: options.limit || 20,
            nextCursor: data.pagination?.nextPageCursor,
            prevCursor: data.pagination?.prevPageCursor,
          },
        };
      } catch (error) {
        this.logger.error(
          { message: 'Error fetching products from Squarespace' },
          error instanceof Error ? error : new Error(String(error))
        );
        return {
          products: [],
          pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit || 20 },
        };
      }
    });
  }

  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Squarespace product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SQUARESPACE, async () => {
      try {
        const apiUrl = `https://api.squarespace.com/${this.config.apiVersion}/commerce/products/${productId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from Squarespace: ${response.statusText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product ${productId} from Squarespace` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  async createProduct(product: Product): Promise<Product> {
    // Squarespace doesn't support product creation via API
    // Products must be created through the Squarespace dashboard
    throw new Error('Squarespace API does not support product creation. Please create products through the Squarespace dashboard.');
  }

  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    // Squarespace has limited product update capabilities via API
    throw new Error('Squarespace API has limited product update support. Please update products through the Squarespace dashboard.');
  }

  async deleteProduct(productId: string): Promise<boolean> {
    // Squarespace doesn't support product deletion via API
    throw new Error('Squarespace API does not support product deletion. Please delete products through the Squarespace dashboard.');
  }

  async syncProducts(products: Product[]): Promise<SyncResult> {
    // Squarespace is read-only for products via API
    return {
      successful: 0,
      failed: products.length,
      errors: products.map(p => ({
        productId: p.id,
        error: 'Squarespace API does not support product sync. Products are read-only.',
      })),
    };
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'RetailPOS/1.0',
    };
  }

  protected mapToProduct(sqProduct: any): Product {
    // Extract variants
    const variants = (sqProduct.variants || []).map((variant: any) => ({
      id: variant.id,
      title: variant.attributes ? Object.values(variant.attributes).join(' / ') : 'Default',
      sku: variant.sku || '',
      barcode: variant.barcode,
      price: variant.pricing?.basePrice?.value ? parseFloat(variant.pricing.basePrice.value) / 100 : 0,
      compareAtPrice: variant.pricing?.salePrice?.value ? parseFloat(variant.pricing.salePrice.value) / 100 : undefined,
      inventoryQuantity: variant.stock?.quantity || 0,
      weight: variant.shippingMeasurements?.weight?.value,
      weightUnit: variant.shippingMeasurements?.weight?.unit || 'lb',
    }));

    // If no variants, create default
    if (variants.length === 0) {
      variants.push({
        id: sqProduct.id,
        title: 'Default',
        sku: '',
        price: sqProduct.pricing?.basePrice?.value ? parseFloat(sqProduct.pricing.basePrice.value) / 100 : 0,
        inventoryQuantity: 0,
      });
    }

    // Extract images
    const images = (sqProduct.images || []).map((img: any, index: number) => ({
      id: img.id || String(index),
      url: img.url || img.originalUrl || '',
      alt: img.altText || '',
      position: img.orderIndex || index,
    }));

    return {
      id: sqProduct.id,
      title: sqProduct.name || '',
      description: sqProduct.description || '',
      vendor: sqProduct.vendor || '',
      productType: sqProduct.productType || sqProduct.type || '',
      tags: sqProduct.tags || [],
      options: (sqProduct.variantAttributes || []).map((attr: any) => ({
        id: attr.name,
        name: attr.name,
        values: attr.values || [],
      })),
      variants,
      images,
      createdAt: sqProduct.createdOn ? new Date(sqProduct.createdOn) : undefined,
      updatedAt: sqProduct.modifiedOn ? new Date(sqProduct.modifiedOn) : undefined,
    };
  }
}
