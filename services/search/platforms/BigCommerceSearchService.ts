/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';

/**
 * BigCommerce-specific implementation of the search service
 */
export class BigCommerceSearchService extends BaseSearchService {
  private apiClient = BigCommerceApiClient.getInstance();
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

  /**
   * Create a new BigCommerce search service
   * @param config Configuration for BigCommerce API
   */
  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }
  /**
   * Initialize the BigCommerce search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.clientId = this.config.clientId || process.env.BIGCOMMERCE_CLIENT_ID || '';
      this.config.apiToken = this.config.apiToken || process.env.BIGCOMMERCE_API_TOKEN || '';
      this.config.storeHash = this.config.storeHash || process.env.BIGCOMMERCE_STORE_HASH || '';
      this.config.apiVersion = this.config.apiVersion || process.env.BIGCOMMERCE_API_VERSION || '';

      if (!this.config.clientId || !this.config.apiToken || !this.config.storeHash) {
        this.logger.warn({ message: 'Missing BigCommerce API configuration' });
        return false;
      }

      // Configure and initialize the shared BigCommerce client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeHash: this.config.storeHash as string,
          accessToken: this.config.apiToken as string,
          clientId: this.config.clientId as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      // Test connection with a simple API call
      try {
        await this.apiClient.get('catalog/summary');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to BigCommerce API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing BigCommerce search service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get configuration requirements for BigCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['clientId', 'apiToken', 'storeHash'],
      optional: ['apiVersion'],
      description: 'BigCommerce requires a client ID, API token, and store hash for authentication',
    };
  }

  /**
   * Search for products in BigCommerce
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    try {
      if (!this.isInitialized()) {
        this.logger.warn({ message: 'BigCommerce search service not initialized. Cannot perform search.' });
        return [];
      }

      // Convert search options to product query options format
      const queryOptions = this.mapToProductQueryOptions(query, options);

      // Get products from BigCommerce
      const response = await this.getProducts(queryOptions);

      if (response && response.products) {
        return response.products.map(product => this.mapToSearchProduct(product));
      }

      return [];
    } catch (error) {
      this.logger.error({ message: 'Error searching BigCommerce products' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get products from BigCommerce with filtering
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce search service not initialized');
    }

    try {
      // Build query parameters for BigCommerce API
      const queryParams = new URLSearchParams();

      if (options.limit) {
        queryParams.append('limit', options.limit.toString());
      }

      if (options.page) {
        queryParams.append('page', options.page.toString());
      }

      if (options.search) {
        // BigCommerce uses keyword for searching
        queryParams.append('keyword', options.search);
      }

      if (options.ids && options.ids.length > 0) {
        queryParams.append('id:in', options.ids.join(','));
      }

      if (options.category) {
        queryParams.append('categories:in', options.category);
      }

      if (options.includeOutOfStock === false) {
        queryParams.append('inventory_level:greater_than', '0');
      }

      // API endpoint with query parameters
      const data = await this.apiClient.get<{ data: any[]; meta: any }>(`catalog/products?${queryParams.toString()}`);

      // Extract pagination info
      const meta = data.meta || {};
      const pagination = meta.pagination || {};

      return {
        products: data.data || [],
        pagination: {
          currentPage: pagination.current_page || 1,
          totalPages: pagination.total_pages || 1,
          totalItems: pagination.total || data.data?.length || 0,
          perPage: pagination.per_page || options.limit || data.data?.length || 0,
        },
      };
    } catch (error) {
      this.logger.error({ message: 'Error fetching products from BigCommerce' }, error instanceof Error ? error : new Error(String(error)));
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
   * Search BigCommerce products by barcode (UPC field).
   * GET /catalog/products?upc=<barcode>&include=variants,images returns exact UPC matches.
   */
  async searchByBarcode(barcode: string): Promise<SearchProduct[]> {
    if (!this.isInitialized()) return [];

    try {
      const data = await this.apiClient.get<{ data: any[] }>(`catalog/products`, { upc: barcode, include: 'variants,images', limit: '5' });
      return (data.data || []).map((p: any) => this.mapToSearchProduct(p));
    } catch (error) {
      this.logger.error(
        { message: `BigCommerce barcode search failed for ${barcode}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Get all categories from BigCommerce
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce search service not initialized');
    }

    try {
      const data = await this.apiClient.get<{ data: any[] }>('catalog/categories');
      return (data.data || []).map((category: any) => category.name);
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching categories from BigCommerce' },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }
}
