/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';

/**
 * Wix-specific implementation of the search service
 */
export class WixSearchService extends BaseSearchService {
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

  /**
   * Create a new Wix search service
   * @param config Configuration for Wix API
   */
  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }

  /**
   * Initialize the Wix search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.apiKey = this.config.apiKey || process.env.WIX_API_KEY || '';
      this.config.siteId = this.config.siteId || process.env.WIX_SITE_ID || '';
      this.config.accountId = this.config.accountId || process.env.WIX_ACCOUNT_ID || '';
      this.config.apiVersion = this.config.apiVersion || process.env.WIX_API_VERSION || 'v1';

      if (!this.config.apiKey || !this.config.siteId) {
        console.warn('Missing Wix API configuration');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Wix API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Wix API:', error);
        return false;
      }
    } catch (error) {
      console.error('Error initializing Wix search service:', error);
      return false;
    }
  }

  /**
   * Get configuration requirements for Wix
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiKey', 'siteId'],
      optional: ['accountId', 'apiVersion'],
      description: 'Wix requires an API key and site ID for authentication',
    };
  }

  /**
   * Search for products in Wix
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    try {
      if (!this.isInitialized()) {
        console.warn('Wix search service not initialized. Cannot perform search.');
        return [];
      }

      // Convert search options to product query options format
      const queryOptions = this.mapToProductQueryOptions(query, options);

      // Get products from Wix
      const response = await this.getProducts(queryOptions);

      if (response && response.products) {
        return response.products.map(product => this.mapToSearchProduct(product));
      }

      return [];
    } catch (error) {
      console.error('Error searching Wix products:', error);
      return [];
    }
  }

  /**
   * Get products from Wix with filtering
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Wix search service not initialized');
    }

    try {
      // Wix uses a query format for its API calls
      const query: Record<string, any> = {
        query: {
          paging: {
            limit: options.limit || 100,
            offset: options.page ? (options.page - 1) * (options.limit || 100) : 0,
          },
          sort: [{ fieldName: 'name', order: 'ASC' }],
        },
      };

      if (options.search) {
        query.query.filter = {
          ...query.query.filter,
          name: { $contains: options.search },
        };
      }

      if (options.ids && options.ids.length > 0) {
        query.query.filter = {
          ...query.query.filter,
          _id: { $in: options.ids },
        };
      }

      if (options.includeOutOfStock === false) {
        query.query.filter = {
          ...query.query.filter,
          stock: { $gt: 0 },
        };
      }

      if (options.category) {
        query.query.filter = {
          ...query.query.filter,
          collectionIds: { $hasSome: [await this.getCategoryIdByName(options.category)] },
        };
      }

      // Make API request
      const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/products/query`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        throw new Error(`Wix API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const products = data.products || [];
      const totalItems = data.totalResults || products.length;
      const perPage = options.limit || 100;

      return {
        products,
        pagination: {
          currentPage: options.page || 1,
          totalPages: Math.ceil(totalItems / perPage),
          totalItems,
          perPage,
        },
      };
    } catch (error) {
      console.error('Error fetching products from Wix:', error);
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
   * Get all categories from Wix (collections in Wix terminology)
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Wix search service not initialized');
    }

    try {
      const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/collections`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Wix API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return (data.collections || []).map((collection: any) => collection.name);
    } catch (error) {
      console.error('Error fetching categories from Wix:', error);
      return [];
    }
  }

  /**
   * Get category ID by name - helper function for Wix
   */
  private async getCategoryIdByName(categoryName: string): Promise<string | null> {
    if (!this.isInitialized()) {
      throw new Error('Wix search service not initialized');
    }

    try {
      const apiUrl = `https://www.wixapis.com/stores/${this.config.apiVersion}/collections`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Wix API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const collection = (data.collections || []).find((col: any) => col.name === categoryName);
      return collection ? collection._id : null;
    } catch (error) {
      console.error('Error finding category ID by name in Wix:', error);
      return null;
    }
  }

  /**
   * Get authorization headers for Wix API
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `${this.config.apiKey}`,
      'wix-site-id': `${this.config.siteId}`,
      'wix-account-id': (this.config.accountId as string) || '',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }
}
