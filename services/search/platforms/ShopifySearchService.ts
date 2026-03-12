/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { ShopifyApiClient } from '../../clients/shopify/ShopifyApiClient';

// Import directly from the file to work around module resolution issues
import { BaseSearchService } from './BaseSearchService';

/**
 * Shopify-specific implementation of the search service
 */
export class ShopifySearchService extends BaseSearchService {
  private apiClient = ShopifyApiClient.getInstance();

  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }
  /**
   * Initialize the Shopify search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.apiKey = this.config.apiKey || process.env.SHOPIFY_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SHOPIFY_API_SECRET || '';
      this.config.storeUrl = this.config.storeUrl || process.env.SHOPIFY_STORE_URL || '';
      this.config.accessToken = this.config.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || '';

      if (!this.config.apiKey || !this.config.accessToken || !this.config.storeUrl) {
        this.logger.warn({ message: 'Missing Shopify API configuration' });
        return false;
      }

      // Configure and initialize the shared Shopify client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl as string,
          apiKey: this.config.apiKey as string,
          apiSecret: this.config.apiSecret as string,
          accessToken: this.config.accessToken as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }
      this.config.storeUrl = this.apiClient.getBaseUrl();

      // Test connection with a simple API call
      try {
        await this.apiClient.get('shop.json');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Shopify API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing Shopify search service' },
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
      optional: ['apiVersion'],
      description: 'Shopify requires an API key, access token, and store URL for authentication',
    };
  }

  /**
   * Search for products in Shopify
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    try {
      if (!this.isInitialized()) {
        this.logger.warn({ message: 'Shopify search service not initialized. Cannot perform search.' });
        return [];
      }

      // Convert search options to product query options format
      const queryOptions = this.mapToProductQueryOptions(query, options);

      // Get products from Shopify
      const response = await this.getProducts(queryOptions);

      if (response && response.products) {
        return response.products.map(product => this.mapToSearchProduct(product));
      }

      return [];
    } catch (error) {
      this.logger.error({ message: 'Error searching Shopify products' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get products from Shopify with filtering
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Shopify search service not initialized');
    }

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      if (options.limit) {
        queryParams.append('limit', options.limit.toString());
      }

      if (options.page) {
        // Shopify uses the "page" parameter for pagination
        queryParams.append('page', options.page.toString());
      }

      if (options.search) {
        // Shopify uses the "title" parameter for searching by title
        queryParams.append('title', options.search);
      }

      if (options.ids && options.ids.length > 0) {
        queryParams.append('ids', options.ids.join(','));
      }

      // Make API request
      const data = await this.apiClient.get<{ products: any[] }>(`products.json?${queryParams.toString()}`);

      // Extract pagination info from headers or response body
      const totalPages = 1;
      const totalItems = data.products?.length || 0;

      return {
        products: data.products || [],
        pagination: {
          currentPage: options.page || 1,
          totalPages: totalPages,
          totalItems: totalItems,
          perPage: options.limit || data.products?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error({ message: 'Error fetching products from Shopify' }, error instanceof Error ? error : new Error(String(error)));
      return {
        products: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
        },
      };
    }
  }

  /**
   * Search Shopify products by barcode via the variants endpoint.
   * GET /admin/api/{version}/variants.json?fields=id,product_id,barcode,sku,price,inventory_quantity
   * then filter client-side for the exact barcode (Shopify doesn't support barcode= query param directly).
   */
  async searchByBarcode(barcode: string): Promise<SearchProduct[]> {
    if (!this.isInitialized()) return [];

    try {
      const data = await this.apiClient.get<{ products: any[] }>(`products.json?fields=id,title,variants,images,product_type&limit=5`);
      const matched = (data.products || []).filter((p: any) =>
        (p.variants || []).some((v: any) => v.barcode === barcode || v.sku === barcode)
      );
      return matched.map((p: any) => this.mapToSearchProduct(p));
    } catch (error) {
      this.logger.error(
        { message: `Shopify barcode search failed for ${barcode}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Get all categories (collections) from Shopify
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify search service not initialized');
    }

    try {
      const data = await this.apiClient.get<{ custom_collections: any[] }>('custom_collections.json');
      return (data.custom_collections || []).map((collection: any) => collection.title);
    } catch (error) {
      this.logger.error({ message: 'Error fetching categories from Shopify' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}
