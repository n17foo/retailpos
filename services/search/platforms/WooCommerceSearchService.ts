/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';
import { WooCommerceApiClient } from '../../clients/woocommerce/WooCommerceApiClient';

/**
 * WooCommerce-specific implementation of the search service
 */
export class WooCommerceSearchService extends BaseSearchService {
  private apiClient = WooCommerceApiClient.getInstance();
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

  /**
   * Create a new WooCommerce search service
   * @param config Configuration for WooCommerce API
   */
  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }

  /**
   * Initialize the WooCommerce search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.consumerKey = this.config.consumerKey || process.env.WOOCOMMERCE_KEY || '';
      this.config.consumerSecret = this.config.consumerSecret || process.env.WOOCOMMERCE_SECRET || '';
      this.config.storeUrl = this.config.storeUrl || process.env.WOOCOMMERCE_URL || '';
      this.config.apiVersion = this.config.apiVersion || process.env.WOOCOMMERCE_API_VERSION || '';

      if (!this.config.consumerKey || !this.config.consumerSecret || !this.config.storeUrl) {
        this.logger.warn({ message: 'Missing WooCommerce API configuration' });
        return false;
      }

      // Configure and initialize the shared WooCommerce client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl as string,
          consumerKey: this.config.consumerKey as string,
          consumerSecret: this.config.consumerSecret as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      // Test connection with a simple API call
      try {
        await this.apiClient.get('products');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to WooCommerce API:' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing WooCommerce search service:' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get configuration requirements for WooCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['consumerKey', 'consumerSecret', 'storeUrl'],
      optional: ['apiVersion'],
      description: 'WooCommerce requires a consumer key, consumer secret, and store URL for authentication',
    };
  }

  /**
   * Search for products in WooCommerce
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    try {
      if (!this.isInitialized()) {
        this.logger.warn({ message: 'WooCommerce search service not initialized. Cannot perform search.' });
        return [];
      }

      // Convert search options to product query options format
      const queryOptions = this.mapToProductQueryOptions(query, options);

      // Get products from WooCommerce
      const response = await this.getProducts(queryOptions);

      if (response && response.products) {
        return response.products.map(product => this.mapToSearchProduct(product));
      }

      return [];
    } catch (error) {
      this.logger.error({ message: 'Error searching WooCommerce products:' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get products from WooCommerce with filtering
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce search service not initialized');
    }

    try {
      // Build query parameters for WooCommerce API
      const queryParams = new URLSearchParams();

      if (options.limit) {
        queryParams.append('per_page', options.limit.toString());
      }

      if (options.page) {
        queryParams.append('page', options.page.toString());
      }

      if (options.search) {
        queryParams.append('search', options.search);
      }

      if (options.ids && options.ids.length > 0) {
        queryParams.append('include', options.ids.join(','));
      }

      if (options.category) {
        // In WooCommerce, we need to get category ID from name
        const categoryId = await this.getCategoryIdByName(options.category);
        if (categoryId) {
          queryParams.append('category', categoryId);
        }
      }

      if (options.includeOutOfStock === false) {
        queryParams.append('stock_status', 'instock');
      }

      // API endpoint with query parameters
      const products = await this.apiClient.get<any[]>(`products?${queryParams.toString()}`);

      return {
        products: products || [],
        pagination: {
          currentPage: options.page || 1,
          totalPages: 1,
          totalItems: products?.length || 0,
          perPage: options.limit || 10,
        },
      };
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching products from WooCommerce:' },
        error instanceof Error ? error : new Error(String(error))
      );
      return {
        products: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          perPage: 0,
        },
      };
    }
  }

  /**
   * Search WooCommerce products by barcode/SKU.
   * WooCommerce stores barcodes in variant SKU field; GET /products?sku=<barcode> returns exact matches.
   */
  async searchByBarcode(barcode: string): Promise<SearchProduct[]> {
    if (!this.isInitialized()) return [];

    try {
      const products = await this.apiClient.get<any[]>(`products`, { sku: barcode, per_page: '5' });
      return (products || []).map((p: any) => this.mapToSearchProduct(p));
    } catch (error) {
      this.logger.error(
        { message: `WooCommerce barcode search failed for ${barcode}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Get all categories from WooCommerce
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce search service not initialized');
    }

    try {
      const data = await this.apiClient.get<any[]>('products/categories');
      return (data || []).map((category: any) => category.name);
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching categories from WooCommerce:' },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Get category ID by name - helper function for WooCommerce
   */
  private async getCategoryIdByName(categoryName: string): Promise<string | null> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce search service not initialized');
    }

    try {
      const data = await this.apiClient.get<any[]>('products/categories');
      const category = (data || []).find((cat: any) => cat.name === categoryName);
      return category ? category.id.toString() : null;
    } catch (error) {
      this.logger.error({ message: 'Error finding category ID by name:' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }
}
