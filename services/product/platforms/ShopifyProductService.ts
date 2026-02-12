import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { getPlatformToken } from '../../token/tokenUtils';
import { TokenType } from '../../token/tokenServiceInterface';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import { SHOPIFY_API_VERSION } from '../../config/apiVersions';

/**
 * Shopify-specific implementation of the product service
 */
export class ShopifyProductService extends BaseProductService {
  // The config property is inherited from BaseProductService

  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('ShopifyProductService');
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

      // Normalize the store URL
      this.config.storeUrl = this.normalizeStoreUrl(this.config.storeUrl);

      // Initialize the token provider for Shopify
      const tokenInitialized = await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SHOPIFY);
      if (!tokenInitialized) {
        this.logger.warn('Failed to initialize Shopify token provider');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = `${this.config.storeUrl}/admin/api/${this.config.apiVersion || SHOPIFY_API_VERSION}/shop.json`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          headers,
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          const responseText = await response.text();
          this.logger.error(
            { message: 'Failed to connect to Shopify API' },
            new Error(`Shopify API responded with status ${response.status}: ${responseText}`)
          );
          return false;
        }
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.logger.error({ message: 'Error connecting to Shopify API' }, errorObj);
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Shopify product service', error);
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
        const apiVersion = this.config.apiVersion || '2024-01';

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
        // If a cursor is provided, use it for pagination
        if (options.cursor) {
          queryParams.append('page_info', options.cursor);
        }

        const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/products.json?${queryParams.toString()}`;

        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from Shopify: ${response.statusText}`);
        }

        const data = await response.json();

        // Map Shopify products to our format
        const products: Product[] = data.products.map((shopifyProduct: any) => this.mapToProduct(shopifyProduct));

        // Parse cursor-based pagination from Link header
        const linkHeader = response.headers.get('Link') || '';
        const paginationInfo = this.parsePaginationFromLinkHeader(linkHeader);

        return {
          products,
          pagination: {
            currentPage: options.page || 1,
            totalPages: paginationInfo.hasNextPage ? (options.page || 1) + 1 : options.page || 1,
            totalItems: products.length, // Shopify doesn't provide total count in REST API
            perPage: limit,
            nextCursor: paginationInfo.nextCursor,
            prevCursor: paginationInfo.prevCursor,
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
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/products/${productId}.json`;

      const headers = await this.getAuthHeaders();
      const response = await fetch(apiUrl, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch product from Shopify: ${response.statusText}`);
      }

      const data = await response.json();

      // Map Shopify product to our format
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
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/products.json`;

      const shopifyProduct = this.mapToShopifyProduct(product);

      const headers = await this.getAuthHeaders();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product: shopifyProduct }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create product on Shopify: ${response.statusText}`);
      }

      const data = await response.json();

      // Map created Shopify product to our format
      return this.mapToProduct(data.product);
    } catch (error) {
      console.error('Error creating product on Shopify', error);
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
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/products/${productId}.json`;

      // Get the existing product
      const existingProduct = await this.getProductById(productId);
      if (!existingProduct) {
        throw new Error(`Product with ID ${productId} not found`);
      }

      // Merge the existing product with the update data
      const updatedProduct = { ...existingProduct, ...productData };

      // Map to Shopify format
      const shopifyProduct = this.mapToShopifyProduct(updatedProduct);

      const headers = await this.getAuthHeaders();
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product: shopifyProduct }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update product on Shopify: ${response.statusText}`);
      }

      const data = await response.json();

      // Map updated Shopify product to our format
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
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const apiUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/products/${productId}.json`;

      const headers = await this.getAuthHeaders();
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to delete product from Shopify: ${response.statusText}`);
      }

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
   * Create authorization headers for Shopify API
   */
  /**
   * Get authorization headers for API requests
   * Override the base class method to provide async token retrieval
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const accessToken = await getPlatformToken(ECommercePlatform.SHOPIFY, TokenType.ACCESS);

      if (!accessToken) {
        throw new Error('Failed to get Shopify access token');
      }

      return {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      this.logger.error({ message: 'Error getting Shopify auth headers' }, error instanceof Error ? error : new Error(String(error)));

      // Fallback to config token if available (for backward compatibility)
      return {
        'X-Shopify-Access-Token': this.config.accessToken || '',
        'Content-Type': 'application/json',
      };
    }
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
  private mapToShopifyProduct(product: Product): any {
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

  /**
   * Pagination info extracted from Shopify Link header
   */
  private parsePaginationFromLinkHeader(linkHeader: string): {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
    prevCursor?: string;
  } {
    const result = {
      hasNextPage: false,
      hasPrevPage: false,
      nextCursor: undefined as string | undefined,
      prevCursor: undefined as string | undefined,
    };

    if (!linkHeader) {
      return result;
    }

    // Parse the Link header
    // Format: <url>; rel="next", <url>; rel="previous"
    const links = linkHeader.split(',');

    for (const link of links) {
      const parts = link.trim().split(';');
      if (parts.length < 2) continue;

      const urlPart = parts[0].trim();
      const relPart = parts[1].trim();

      // Extract URL from angle brackets
      const urlMatch = urlPart.match(/<(.+)>/);
      const relMatch = relPart.match(/rel="(.+)"/);

      if (urlMatch && relMatch) {
        const url = urlMatch[1];
        const rel = relMatch[1];

        // Extract page_info cursor from URL
        const urlParams = new URL(url).searchParams;
        const pageInfo = urlParams.get('page_info');

        if (rel === 'next' && pageInfo) {
          result.hasNextPage = true;
          result.nextCursor = pageInfo;
        } else if (rel === 'previous' && pageInfo) {
          result.hasPrevPage = true;
          result.prevCursor = pageInfo;
        }
      }
    }

    return result;
  }

  /**
   * Normalize the store URL to ensure it has the correct format
   */
  private normalizeStoreUrl(url: string): string {
    if (!url) return '';

    // Remove trailing slash
    url = url.replace(/\/$/, '');

    // Ensure https:// prefix
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    return url;
  }
}
