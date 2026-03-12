/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

/**
 * Shopify-specific implementation of the product service
 */
export class ShopifyProductService extends BaseProductService {
  private apiClient: ShopifyApiClient;

  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyProductService');
    this.apiClient = ShopifyApiClient.getInstance();
  }

  /**
   * Initialize the Shopify product service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.apiKey = this.config.apiKey || process.env.SHOPIFY_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SHOPIFY_API_SECRET || '';
      this.config.storeUrl = this.config.storeUrl || process.env.SHOPIFY_STORE_URL || '';

      if (!this.config.apiKey || !this.config.storeUrl) {
        this.logger.warn('Missing Shopify API configuration');
        return false;
      }

      // Configure and initialize the shared Shopify client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl,
          apiKey: this.config.apiKey,
          apiSecret: this.config.apiSecret as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        const ok = await this.apiClient.initialize();
        if (!ok) {
          this.logger.warn({ message: 'Failed to initialize Shopify API client' });
          return false;
        }
      }

      // Normalize the store URL from the client
      this.config.storeUrl = this.apiClient.getBaseUrl();

      // Test connection with a simple API call
      try {
        await this.apiClient.get('shop.json');
        this.initialized = true;
        return true;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.logger.error({ message: 'Error connecting to Shopify API' }, errorObj);
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Shopify product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get configuration requirements for Shopify
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey', 'accessToken', 'storeUrl'],
      optional: ['apiVersion', 'webhookUrl'],
      description: 'Shopify product service requires API key, access token, and store URL',
    };
  }

  /**
   * Get products from Shopify
   * Uses cursor-based pagination as required by Shopify API
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Shopify product service not initialized');
    }

    try {
      // Use token refresh wrapper to handle token expiration
      return await withTokenRefresh(ECommercePlatform.SHOPIFY, async () => {
        const limit = options.limit || 50;

        // Build query params
        const queryParams = new URLSearchParams();
        queryParams.append('limit', String(limit));

        if (options.search) {
          queryParams.append('title', options.search);
        }

        if (options.ids && options.ids.length > 0) {
          queryParams.append('ids', options.ids.join(','));
        }

        if (options.category) {
          queryParams.append('product_type', options.category);
        }

        // Handle cursor-based pagination
        if (options.cursor) {
          queryParams.append('page_info', options.cursor);
        }

        const data = await this.apiClient.get<{ products: any[] }>(`products.json?${queryParams.toString()}`);

        const products: Product[] = data.products.map((shopifyProduct: any) => this.mapToProduct(shopifyProduct));

        return {
          products,
          pagination: {
            currentPage: options.page || 1,
            totalPages: options.page || 1,
            totalItems: products.length,
            perPage: limit,
          },
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Error fetching products from Shopify' }, error instanceof Error ? error : new Error(String(error)));
      return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit } };
    }
  }

  /**
   * Get a single product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Shopify product service not initialized');
    }

    try {
      const data = await this.apiClient.get<{ product: any }>(`products/${productId}.json`);
      return this.mapToProduct(data.product);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching product ${productId} from Shopify` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Create a new product on Shopify
   */
  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Shopify product service not initialized');
    }

    try {
      const shopifyProduct = this.mapToShopifyProduct(product);
      const data = await this.apiClient.post<{ product: any }>('products.json', { product: shopifyProduct });
      return this.mapToProduct(data.product);
    } catch (error) {
      this.logger.error({ message: 'Error creating product on Shopify' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a product on Shopify
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Shopify product service not initialized');
    }

    try {
      // Get the existing product
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      const updatedProduct = { ...existingProduct, ...productData };
      const shopifyProduct = this.mapToShopifyProduct(updatedProduct);
      const data = await this.apiClient.put<{ product: any }>(`products/${productId}.json`, { product: shopifyProduct });
      return this.mapToProduct(data.product);
    } catch (error) {
      this.logger.error(
        { message: `Error updating product ${productId} on Shopify` },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Delete a product from Shopify
   */
  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Shopify product service not initialized');
    }

    try {
      await this.apiClient.delete(`products/${productId}.json`);
      return true;
    } catch (error) {
      this.logger.error(
        { message: `Error deleting product ${productId} from Shopify` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Sync products with Shopify
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('Shopify product service not initialized');
    }

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const product of products) {
      try {
        // Check if the product already exists
        const existingProduct = await this.getProductById(product.id);

        if (existingProduct) {
          // Update the existing product
          await this.updateProduct(product.id, product);
        } else {
          // Create a new product
          await this.createProduct(product);
        }

        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          productId: product.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Map a Shopify product to our standard format
   */

  protected mapToProduct(shopifyProduct: any): Product {
    const variants =
      shopifyProduct.variants?.map((variant: any) => ({
        id: variant.id.toString(),
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        price: parseFloat(variant.price),
        compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : undefined,
        inventoryQuantity: variant.inventory_quantity || 0,
        weight: variant.weight,
        weightUnit: variant.weight_unit,
        options: variant.option_values?.map((opt: any) => opt.value) || [],
      })) || [];

    const options =
      shopifyProduct.options?.map((option: any) => ({
        id: option.id.toString(),
        name: option.name,
        values: option.values,
      })) || [];

    const images =
      shopifyProduct.images?.map((image: any) => ({
        id: image.id.toString(),
        url: image.src,
        alt: image.alt || '',
        position: image.position,
      })) || [];

    return {
      id: shopifyProduct.id.toString(),
      title: shopifyProduct.title,
      description: shopifyProduct.body_html || '',
      vendor: shopifyProduct.vendor,
      productType: shopifyProduct.product_type,
      tags: shopifyProduct.tags ? shopifyProduct.tags.split(',').map((tag: string) => tag.trim()) : [],
      options,
      variants,
      images,
      createdAt: shopifyProduct.created_at ? new Date(shopifyProduct.created_at) : undefined,
      updatedAt: shopifyProduct.updated_at ? new Date(shopifyProduct.updated_at) : undefined,
    };
  }

  /**
   * Map our product format to Shopify's format
   */
  private mapToShopifyProduct(product: Product): Record<string, unknown> {
    return {
      title: product.title,
      body_html: product.description,
      vendor: product.vendor,
      product_type: product.productType,
      tags: product.tags?.join(','),
      options: product.options?.map(option => ({
        name: option.name,
        values: option.values,
      })),
      variants: product.variants?.map(variant => ({
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        compare_at_price: variant.compareAtPrice,
        inventory_quantity: variant.inventoryQuantity,
        weight: variant.weight,
        weight_unit: variant.weightUnit,
        option_values: variant.options?.map((optValue, index) => ({
          option_id: product.options && product.options[index] ? product.options[index].id : '',
          value: optValue,
        })),
      })),
      images: product.images?.map(image => ({
        src: image.url,
        alt: image.alt,
        position: image.position,
      })),
    };
  }
}
