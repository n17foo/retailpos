/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { TokenInitializer } from '../../../services/token/TokenInitializer';
import { getPlatformToken } from '../../../services/token/TokenUtils';
import { TokenType } from '../../../services/token/TokenServiceInterface';
import { withTokenRefresh } from '../../../services/token/TokenIntegration';
import { BIGCOMMERCE_API_VERSION } from '../../config/apiVersions';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * BigCommerce-specific implementation of the product service
 */
export class BigCommerceProductService extends BaseProductService {
  // The config property is inherited from BaseProductService

  /**
   * Create a new BigCommerce product service
   * @param config Configuration for BigCommerce API
   */
  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('BigCommerceProductService');
  }

  /**
   * Initialize the BigCommerce product service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.storeHash = this.config.storeHash || process.env.BIGCOMMERCE_STORE_HASH || '';

      // Initialize the token provider for BigCommerce
      const tokenInitializer = TokenInitializer.getInstance();
      const initialized = await tokenInitializer.initializePlatformToken(ECommercePlatform.BIGCOMMERCE);

      if (!initialized) {
        this.logger.warn('Failed to initialize BigCommerce token provider');
      }

      if (!this.config.storeHash) {
        this.logger.warn('Missing BigCommerce store hash configuration');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = this.getApiUrl('/catalog/summary');
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          headers,
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          const errorText = await response.text();
          this.logger.error(
            { message: `Failed to connect to BigCommerce API: ${response.status}`, response: errorText },
            new Error(`HTTP error ${response.status}`)
          );
          return false;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.logger.error({ message: 'Error connecting to BigCommerce API' }, errorObj);
        return false;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error({ message: 'Failed to initialize BigCommerce product service' }, errorObj);
      return false;
    }
  }

  /**
   * Get configuration requirements for BigCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeHash', 'accessToken'],
      optional: ['clientId', 'apiVersion'],
      description: 'BigCommerce product service requires store hash and access token',
    };
  }

  /**
   * Get products from BigCommerce
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
      try {
        const params = new URLSearchParams();

        // Set pagination
        params.append('limit', String(options.limit || 10));
        params.append('page', String(options.page || 1));

        // Set search if provided
        if (options.search) {
          params.append('keyword', options.search);
        }

        // Set category if provided
        if (options.category) {
          params.append('categories:in', options.category);
        }

        // Set specific IDs if provided
        if (options.ids && options.ids.length > 0) {
          params.append('id:in', options.ids.join(','));
        }

        // Include all related data
        params.append('include', 'variants,images,custom_fields,bulk_pricing_rules,primary_image');

        const apiUrl = this.getApiUrl(`/catalog/products?${params.toString()}`);

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from BigCommerce: ${response.statusText}`);
        }

        const data = await response.json();

        // Map BigCommerce products to our format
        const products = data.data.map((bcProduct: any) => this.mapToProduct(bcProduct));

        return {
          products,
          pagination: {
            currentPage: data.meta.pagination.current_page,
            totalPages: data.meta.pagination.total_pages,
            totalItems: data.meta.pagination.total,
            perPage: data.meta.pagination.per_page,
          },
        };
      } catch (error) {
        this.logger.error(
          { message: 'Error fetching products from BigCommerce' },
          error instanceof Error ? error : new Error(String(error))
        );
        return {
          products: [],
          pagination: {
            currentPage: options.page || 1,
            totalPages: 0,
            totalItems: 0,
            perPage: options.limit || 10,
          },
        };
      }
    });
  }

  /**
   * Get a single product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
      try {
        // Include all related data
        const params = new URLSearchParams();
        params.append('include', 'variants,images,custom_fields,bulk_pricing_rules,primary_image');

        const apiUrl = this.getApiUrl(`/catalog/products/${productId}?${params.toString()}`);

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          headers,
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from BigCommerce: ${response.statusText}`);
        }

        const bcProduct = await response.json();

        // Map BigCommerce product to our format
        return this.mapToProduct(bcProduct.data);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product ${productId} from BigCommerce` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  /**
   * Create a new product on BigCommerce
   */
  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
      try {
        const apiUrl = this.getApiUrl('/catalog/products');

        const bcProduct = this.mapToBigCommerceProduct(product);

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bcProduct),
        });

        if (!response.ok) {
          throw new Error(`Failed to create product on BigCommerce: ${response.statusText}`);
        }

        const createdProduct = await response.json();

        // Map created BigCommerce product to our format
        return this.mapToProduct(createdProduct.data);
      } catch (error) {
        this.logger.error({ message: 'Error creating product on BigCommerce' }, error instanceof Error ? error : new Error(String(error)));
        throw new Error(`Failed to create product: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Update a product on BigCommerce
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
      try {
        const apiUrl = this.getApiUrl(`/catalog/products/${productId}`);

        // Get the existing product
        const existingProduct = await this.getProductById(productId);
        if (!existingProduct) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        // Merge the existing product with the update data
        const updatedProduct = { ...existingProduct, ...productData };

        // Map to BigCommerce format
        const bcProduct = this.mapToBigCommerceProduct(updatedProduct);

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bcProduct),
        });

        if (!response.ok) {
          throw new Error(`Failed to update product on BigCommerce: ${response.statusText}`);
        }

        const updatedBcProduct = await response.json();

        // Map updated BigCommerce product to our format
        return this.mapToProduct(updatedBcProduct.data);
      } catch (error) {
        this.logger.error(
          { message: `Error updating product ${productId} on BigCommerce` },
          error instanceof Error ? error : new Error(String(error))
        );
        throw new Error(`Failed to update product: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Delete a product from BigCommerce
   */
  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.BIGCOMMERCE, async () => {
      try {
        const apiUrl = this.getApiUrl(`/catalog/products/${productId}`);

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to delete product from BigCommerce: ${response.statusText}`);
        }

        return true;
      } catch (error) {
        this.logger.error(
          { message: `Error deleting product ${productId} from BigCommerce` },
          error instanceof Error ? error : new Error(String(error))
        );
        return false;
      }
    });
  }

  /**
   * Sync products with BigCommerce
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce product service not initialized');
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
   * Generate the API URL for BigCommerce V3 API
   */
  private getApiUrl(endpoint: string): string {
    const storeHash = this.config.storeHash;
    const apiVersion = this.config.apiVersion || BIGCOMMERCE_API_VERSION;

    return `https://api.bigcommerce.com/stores/${storeHash}/${apiVersion}${endpoint}`;
  }

  /**
   * Create authorization headers for BigCommerce API
   * @returns Promise resolving to headers object with authentication
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      // Get the access token from token management system
      const accessToken = await getPlatformToken(ECommercePlatform.BIGCOMMERCE, TokenType.ACCESS);
      const clientId = this.config.clientId || (await getPlatformToken(ECommercePlatform.BIGCOMMERCE, TokenType.API_KEY)) || '';

      return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': accessToken || '',
        'X-Auth-Client': String(clientId),
      };
    } catch (error) {
      this.logger.error({ message: 'Error getting BigCommerce auth headers' }, error instanceof Error ? error : new Error(String(error)));

      // Fallback to config values if token retrieval fails
      return {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Auth-Token': this.config.accessToken || '',
        'X-Auth-Client': String(this.config.clientId) || '',
      };
    }
  }

  /**
   * Map a BigCommerce product to our standard format
   */
  protected mapToProduct(bcProduct: any): Product {
    // Map variants
    const variants =
      bcProduct.variants?.map((variant: any) => ({
        id: variant.id.toString(),
        title: variant.option_values?.map((opt: any) => `${opt.option_display_name}: ${opt.label}`).join(' / ') || 'Default',
        sku: variant.sku,
        price: parseFloat(variant.price || bcProduct.price || '0'),
        compareAtPrice: variant.calculated_price !== variant.price ? parseFloat(variant.calculated_price) : undefined,
        inventoryQuantity: variant.inventory_level || 0,
        weight: variant.weight ? parseFloat(variant.weight) : undefined,
        options: variant.option_values?.map((opt: any) => opt.label) || [],
      })) || [];

    // If no variants, create one from the main product
    if (!variants || variants.length === 0) {
      variants.push({
        id: `${bcProduct.id}-default`,
        title: 'Default',
        sku: bcProduct.sku,
        price: parseFloat(bcProduct.price || '0'),
        compareAtPrice: bcProduct.sale_price ? parseFloat(bcProduct.sale_price) : undefined,
        inventoryQuantity: bcProduct.inventory_level || 0,
        weight: bcProduct.weight ? parseFloat(bcProduct.weight) : undefined,
        options: [],
      });
    }

    // Map options
    const options =
      bcProduct.options?.map((option: any) => ({
        id: option.id.toString(),
        name: option.display_name,
        values: option.option_values?.map((val: any) => val.label) || [],
      })) || [];

    // Map images
    const images =
      bcProduct.images?.map((image: any) => ({
        id: image.id.toString(),
        url: image.url_zoom || image.url_standard || image.url,
        alt: image.description || '',
        position: image.sort_order,
      })) || [];

    return {
      id: bcProduct.id.toString(),
      title: bcProduct.name,
      description: bcProduct.description || '',
      vendor: bcProduct.brand_name || bcProduct.brand?.name || '',
      productType: bcProduct.type || bcProduct.categories?.map((cat: any) => cat.name).join(', ') || '',
      tags: [], // BigCommerce doesn't have a direct "tags" concept, using empty array
      options,
      variants,
      images,
      createdAt: bcProduct.date_created ? new Date(bcProduct.date_created) : undefined,
      updatedAt: bcProduct.date_modified ? new Date(bcProduct.date_modified) : undefined,
    };
  }

  /**
   * Map our product format to BigCommerce's format
   */
  private mapToBigCommerceProduct(product: Product): any {
    // Extract the primary variant
    const primaryVariant = product.variants[0] || {
      price: 0,
      sku: '',
      inventoryQuantity: 0,
      weight: undefined,
    };

    return {
      name: product.title,
      type: 'physical', // Could be 'digital' if needed
      description: product.description,
      sku: primaryVariant.sku,
      price: primaryVariant.price,
      weight: primaryVariant.weight || 0,
      inventory_level: primaryVariant.inventoryQuantity,
      inventory_tracking: 'product',
      is_visible: true,
      brand_name: product.vendor,
      categories: product.productType ? [1] : [], // In real implementation, you'd need to map category names to IDs
      images:
        product.images?.map((image, index) => ({
          image_url: image.url,
          description: image.alt || '',
          sort_order: image.position || index,
        })) || [],
      // For variants and options, a more complex mapping would be required
    };
  }
}
