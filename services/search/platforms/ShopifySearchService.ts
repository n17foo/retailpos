/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { SHOPIFY_API_VERSION } from '../../config/apiVersions';

// Import directly from the file to work around module resolution issues
import { BaseSearchService } from './BaseSearchService';

/**
 * Shopify-specific implementation of the search service
 */
export class ShopifySearchService extends BaseSearchService {
  // The config property is inherited from BaseSearchService

  /**
   * Create a new Shopify search service
   * @param config Configuration for Shopify API
   */
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
        console.warn('Missing Shopify API configuration');
        return false;
      }

      // Normalize the store URL
      if (this.config.storeUrl) {
        this.config.storeUrl = this.normalizeShopifyUrl(this.config.storeUrl);
      }

      // Test connection with a simple API call
      try {
        const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
        const response = await fetch(`${this.config.storeUrl}/admin/api/${apiVersion}/shop.json`, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Shopify API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Shopify API:', error);
        return false;
      }
    } catch (error) {
      console.error('Error initializing Shopify search service:', error);
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
        console.warn('Shopify search service not initialized. Cannot perform search.');
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
      console.error('Error searching Shopify products:', error);
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

      // API endpoint with query parameters
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const url = `${this.config.storeUrl}/admin/api/${apiVersion}/products.json?${queryParams.toString()}`;

      // Make API request
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Shopify API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Extract pagination info from headers or response body
      const linkHeader = response.headers.get('Link');
      const hasNextPage = linkHeader && linkHeader.includes('rel="next"');
      const totalPages = parseInt(response.headers.get('X-Shopify-API-Total-Pages') || '1');
      const totalItems = parseInt(response.headers.get('X-Shopify-API-Total-Items') || '0');

      return {
        products: data.products || [],
        pagination: {
          currentPage: options.page || 1,
          totalPages: totalPages,
          totalItems: totalItems || data.products?.length || 0,
          perPage: options.limit || data.products?.length || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching products from Shopify:', error);
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
   * Get all categories (collections) from Shopify
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify search service not initialized');
    }

    try {
      const apiVersion = this.config.apiVersion || SHOPIFY_API_VERSION;
      const url = `${this.config.storeUrl}/admin/api/${apiVersion}/custom_collections.json`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Shopify API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return (data.custom_collections || []).map((collection: any) => collection.title);
    } catch (error) {
      console.error('Error fetching categories from Shopify:', error);
      return [];
    }
  }

  /**
   * Get authorization headers for Shopify API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.config.accessToken as string,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Normalize Shopify store URL to ensure it has the correct format
   */
  private normalizeShopifyUrl(url: string): string {
    // Remove trailing slash if present
    let normalized = url.endsWith('/') ? url.slice(0, -1) : url;

    // Ensure it has https:// prefix
    if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) {
      normalized = 'https://' + normalized;
    }

    return normalized;
  }
}
