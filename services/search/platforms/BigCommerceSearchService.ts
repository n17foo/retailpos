import { SearchOptions, SearchProduct } from '../searchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';
import { BIGCOMMERCE_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * BigCommerce-specific implementation of the search service
 */
export class BigCommerceSearchService extends BaseSearchService {
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
      this.config.apiVersion = this.config.apiVersion || process.env.BIGCOMMERCE_API_VERSION || BIGCOMMERCE_API_VERSION;

      if (!this.config.clientId || !this.config.apiToken || !this.config.storeHash) {
        console.warn('Missing BigCommerce API configuration');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = this.getApiUrl('/catalog/summary');
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to BigCommerce API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to BigCommerce API:', error);
        return false;
      }
    } catch (error) {
      console.error('Error initializing BigCommerce search service:', error);
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
        console.warn('BigCommerce search service not initialized. Cannot perform search.');
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
      console.error('Error searching BigCommerce products:', error);
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
      const apiUrl = this.getApiUrl(`/catalog/products?${queryParams.toString()}`);

      // Make API request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`BigCommerce API request failed with status ${response.status}`);
      }

      const data = await response.json();

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
      console.error('Error fetching products from BigCommerce:', error);
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
   * Get all categories from BigCommerce
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce search service not initialized');
    }

    try {
      const apiUrl = this.getApiUrl('/catalog/categories');
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`BigCommerce API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return (data.data || []).map((category: any) => category.name);
    } catch (error) {
      console.error('Error fetching categories from BigCommerce:', error);
      return [];
    }
  }

  /**
   * Get authorization headers for BigCommerce API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Auth-Token': this.config.apiToken as string,
      'X-Auth-Client': this.config.clientId as string,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Build the full API URL for BigCommerce
   */
  private getApiUrl(endpoint: string): string {
    const storeHash = this.config.storeHash as string;
    const apiVersion = this.config.apiVersion || 'v3';
    return `https://api.bigcommerce.com/stores/${storeHash}/${apiVersion}${endpoint}`;
  }
}
