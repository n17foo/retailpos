import { SearchOptions, SearchProduct } from '../searchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';
import { createBasicAuthHeader } from '../../../utils/base64';
import { WOOCOMMERCE_API_VERSION } from '../../config/ServiceConfigBridge';

/**
 * WooCommerce-specific implementation of the search service
 */
export class WooCommerceSearchService extends BaseSearchService {
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
      this.config.apiVersion = this.config.apiVersion || process.env.WOOCOMMERCE_API_VERSION || WOOCOMMERCE_API_VERSION;

      if (!this.config.consumerKey || !this.config.consumerSecret || !this.config.storeUrl) {
        console.warn('Missing WooCommerce API configuration');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = this.getApiUrl('/products');
        const response = await fetch(apiUrl, {
          headers: {
            Accept: 'application/json',
          },
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to WooCommerce API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to WooCommerce API:', error);
        return false;
      }
    } catch (error) {
      console.error('Error initializing WooCommerce search service:', error);
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
        console.warn('WooCommerce search service not initialized. Cannot perform search.');
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
      console.error('Error searching WooCommerce products:', error);
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
        const categories = await this.getCategories();
        const categoryId = await this.getCategoryIdByName(options.category);
        if (categoryId) {
          queryParams.append('category', categoryId);
        }
      }

      if (options.includeOutOfStock === false) {
        queryParams.append('stock_status', 'instock');
      }

      // API endpoint with query parameters
      const apiUrl = this.getApiUrl(`/products?${queryParams.toString()}`);

      // Make API request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API request failed with status ${response.status}`);
      }

      const products = await response.json();

      // Extract pagination info from headers
      const totalItems = parseInt(response.headers.get('X-WP-Total') || '0');
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '0');

      return {
        products: products || [],
        pagination: {
          currentPage: options.page || 1,
          totalPages: totalPages,
          totalItems: totalItems,
          perPage: options.limit || 10,
        },
      };
    } catch (error) {
      console.error('Error fetching products from WooCommerce:', error);
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
   * Get all categories from WooCommerce
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce search service not initialized');
    }

    try {
      const apiUrl = this.getApiUrl('/products/categories');
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return (data || []).map((category: any) => category.name);
    } catch (error) {
      console.error('Error fetching categories from WooCommerce:', error);
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
      const apiUrl = this.getApiUrl('/products/categories');
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`WooCommerce API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const category = (data || []).find((cat: any) => cat.name === categoryName);
      return category ? category.id.toString() : null;
    } catch (error) {
      console.error('Error finding category ID by name:', error);
      return null;
    }
  }

  /**
   * Get authorization headers for WooCommerce API
   * Uses Basic Auth with consumer key and secret (over HTTPS)
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: createBasicAuthHeader(this.config.consumerKey as string, this.config.consumerSecret as string),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build the full API URL for WooCommerce
   */
  private getApiUrl(endpoint: string): string {
    const storeUrl = this.config.storeUrl as string;
    const apiVersion = this.config.apiVersion || WOOCOMMERCE_API_VERSION;
    return `${storeUrl.replace(/\/$/, '')}/wp-json/${apiVersion}${endpoint}`;
  }
}
