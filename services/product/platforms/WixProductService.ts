/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { WIX_API_VERSION } from '../../config/apiVersions';

/**
 * Wix-specific implementation of the product service
 * Uses Wix Stores API
 */
export class WixProductService extends BaseProductService {
  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('WixProductService');
  }

  /**
   * Initialize the Wix product service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration
      this.config.apiKey = this.config.apiKey || process.env.WIX_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.WIX_SITE_ID || '';
      this.config.accountId = this.config.accountId || process.env.WIX_ACCOUNT_ID || '';
      this.config.apiVersion = this.config.apiVersion || process.env.WIX_API_VERSION || WIX_API_VERSION;

      if (!this.config.apiKey || !this.config.siteId) {
        this.logger.warn('Missing Wix API configuration');
        return false;
      }

      // Initialize token provider
      await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.WIX);

      // Test connection
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/query`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: { paging: { limit: 1 } },
          }),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          this.logger.error({ message: 'Failed to connect to Wix API' }, new Error(`Status: ${response.status}`));
          return false;
        }
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Wix API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to initialize Wix product service' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get configuration requirements
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey', 'siteId'],
      optional: ['accountId', 'apiVersion'],
      description: 'Wix requires API key and site ID for authentication',
    };
  }

  /**
   * Get products from Wix
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Wix product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.WIX, async () => {
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/query`;

        // Build query
        const query: any = {
          paging: {
            limit: options.limit || 20,
            offset: ((options.page || 1) - 1) * (options.limit || 20),
          },
        };

        // Add search filter
        if (options.search) {
          query.filter = {
            name: { $contains: options.search },
          };
        }

        // Add IDs filter
        if (options.ids && options.ids.length > 0) {
          query.filter = {
            ...query.filter,
            id: { $in: options.ids },
          };
        }

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from Wix: ${response.statusText}`);
        }

        const data = await response.json();
        const products = (data.products || []).map((wixProduct: any) => this.mapToProduct(wixProduct));

        return {
          products,
          pagination: {
            currentPage: options.page || 1,
            totalPages: Math.ceil((data.totalResults || products.length) / (options.limit || 20)),
            totalItems: data.totalResults || products.length,
            perPage: options.limit || 20,
          },
        };
      } catch (error) {
        this.logger.error({ message: 'Error fetching products from Wix' }, error instanceof Error ? error : new Error(String(error)));
        return {
          products: [],
          pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit || 20 },
        };
      }
    });
  }

  /**
   * Get a single product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Wix product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.WIX, async () => {
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/${productId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from Wix: ${response.statusText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data.product);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product ${productId} from Wix` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  /**
   * Create a new product on Wix
   */
  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Wix product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.WIX, async () => {
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products`;
        const wixProduct = this.mapToWixProduct(product);

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ product: wixProduct }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create product on Wix: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data.product);
      } catch (error) {
        this.logger.error({ message: 'Error creating product on Wix' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  /**
   * Update a product on Wix
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Wix product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.WIX, async () => {
      try {
        const existingProduct = await this.getProductById(productId);
        if (!existingProduct) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        const updatedProduct = { ...existingProduct, ...productData };
        const wixProduct = this.mapToWixProduct(updatedProduct);

        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/${productId}`;

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ product: wixProduct }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update product on Wix: ${response.statusText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data.product);
      } catch (error) {
        this.logger.error(
          { message: `Error updating product ${productId} on Wix` },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    });
  }

  /**
   * Delete a product from Wix
   */
  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Wix product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.WIX, async () => {
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/${productId}`;

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
        });

        return response.ok;
      } catch (error) {
        this.logger.error(
          { message: `Error deleting product ${productId} from Wix` },
          error instanceof Error ? error : new Error(String(error))
        );
        return false;
      }
    });
  }

  /**
   * Sync products with Wix
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('Wix product service not initialized');
    }

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const product of products) {
      try {
        const existing = await this.getProductById(product.id);

        if (existing) {
          await this.updateProduct(product.id, product);
        } else {
          await this.createProduct(product);
        }

        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Get authorization headers
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: this.config.apiKey as string,
      'wix-site-id': this.config.siteId as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Map Wix product to our format
   */
  protected mapToProduct(wixProduct: any): Product {
    // Extract variants
    const variants = (wixProduct.variants || []).map((variant: any) => ({
      id: variant.id,
      title: variant.choices?.map((c: any) => `${c.option}: ${c.choice}`).join(' / ') || 'Default',
      sku: variant.variant?.sku || variant.sku || '',
      barcode: variant.variant?.barcode,
      price: variant.variant?.priceData?.price || wixProduct.priceData?.price || 0,
      compareAtPrice: variant.variant?.priceData?.discountedPrice,
      inventoryQuantity: variant.stock?.quantity || 0,
      weight: variant.variant?.weight,
      weightUnit: 'kg' as const,
    }));

    // If no variants, create default
    if (variants.length === 0) {
      variants.push({
        id: wixProduct.id,
        title: 'Default',
        sku: wixProduct.sku || '',
        price: wixProduct.priceData?.price || 0,
        inventoryQuantity: wixProduct.stock?.quantity || 0,
      });
    }

    // Extract images
    const images = (wixProduct.media?.items || wixProduct.mediaItems || []).map((media: any, index: number) => ({
      id: media.id || String(index),
      url: media.image?.url || media.url || '',
      alt: media.image?.altText || '',
      position: index,
    }));

    return {
      id: wixProduct.id,
      title: wixProduct.name || '',
      description: wixProduct.description || '',
      vendor: wixProduct.brand || '',
      productType: wixProduct.productType || '',
      tags: wixProduct.ribbons?.map((r: any) => r.text) || [],
      options: (wixProduct.productOptions || []).map((option: any) => ({
        id: option.name,
        name: option.name,
        values: option.choices?.map((c: any) => c.value) || [],
      })),
      variants,
      images,
      createdAt: wixProduct.createdDate ? new Date(wixProduct.createdDate) : undefined,
      updatedAt: wixProduct.lastUpdated ? new Date(wixProduct.lastUpdated) : undefined,
    };
  }

  /**
   * Map our product format to Wix format
   */
  private mapToWixProduct(product: Product): any {
    const primaryVariant = product.variants[0] || { sku: '', price: 0, inventoryQuantity: 0 };

    return {
      name: product.title,
      description: product.description,
      sku: primaryVariant.sku,
      visible: true,
      productType: 'physical',
      priceData: {
        price: primaryVariant.price,
      },
      stock: {
        trackInventory: true,
        quantity: primaryVariant.inventoryQuantity || 0,
        inStock: (primaryVariant.inventoryQuantity || 0) > 0,
      },
      brand: product.vendor,
      media: {
        items:
          product.images?.map((image, index) => ({
            image: {
              url: image.url,
              altText: image.alt,
            },
            mediaType: 'IMAGE',
          })) || [],
      },
    };
  }
}
