import { SearchOptions, SearchProduct } from '../searchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';

/**
 * Magento-specific implementation of the search service
 */
export class MagentoSearchService extends BaseSearchService {
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

  // Token cache and expiration
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  /**
   * Create a new Magento search service
   * @param config Configuration for Magento API
   */
  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }

  /**
   * Initialize the Magento search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.storeUrl = this.config.storeUrl || process.env.MAGENTO_STORE_URL || '';
      this.config.username = this.config.username || process.env.MAGENTO_USERNAME || '';
      this.config.password = this.config.password || process.env.MAGENTO_PASSWORD || '';
      this.config.adminPath = this.config.adminPath || process.env.MAGENTO_ADMIN_PATH || 'admin';

      if (!this.config.storeUrl || !this.config.username || !this.config.password) {
        console.warn('Missing Magento API configuration');
        return false;
      }

      // Test authentication and get token
      try {
        const token = await this.getAuthToken();
        if (!token) {
          console.error('Failed to authenticate with Magento API');
          return false;
        }

        // Test a simple API call
        const apiUrl = `${this.config.storeUrl}/rest/V1/products`;
        const response = await fetch(`${apiUrl}?searchCriteria[pageSize]=1`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Magento API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Magento API:', error);
        return false;
      }
    } catch (error) {
      console.error('Error initializing Magento search service:', error);
      return false;
    }
  }

  /**
   * Get configuration requirements for Magento
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'username', 'password'],
      optional: ['adminPath'],
      description: 'Magento requires store URL, username, and password for authentication',
    };
  }

  /**
   * Search for products in Magento
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    try {
      if (!this.isInitialized()) {
        console.warn('Magento search service not initialized. Cannot perform search.');
        return [];
      }

      // Convert search options to product query options format
      const queryOptions = this.mapToProductQueryOptions(query, options);

      // Get products from Magento
      const response = await this.getProducts(queryOptions);

      if (response && response.products) {
        return response.products.map(product => this.mapToSearchProduct(product));
      }

      return [];
    } catch (error) {
      console.error('Error searching Magento products:', error);
      return [];
    }
  }

  /**
   * Get products from Magento with filtering
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Magento search service not initialized');
    }

    try {
      // Get authentication token
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Failed to authenticate with Magento API');
      }

      // Build Magento search criteria
      let apiUrl = `${this.config.storeUrl}/rest/V1/products`;
      const searchCriteria = [];

      // Pagination
      searchCriteria.push(`searchCriteria[pageSize]=${options.limit || 20}`);
      if (options.page) {
        searchCriteria.push(`searchCriteria[currentPage]=${options.page}`);
      }

      // Search by name/text
      if (options.search) {
        searchCriteria.push(`searchCriteria[filterGroups][0][filters][0][field]=name`);
        searchCriteria.push(`searchCriteria[filterGroups][0][filters][0][value]=%${options.search}%`);
        searchCriteria.push(`searchCriteria[filterGroups][0][filters][0][conditionType]=like`);
      }

      // Filter by specific IDs
      if (options.ids && options.ids.length > 0) {
        searchCriteria.push(`searchCriteria[filterGroups][1][filters][0][field]=entity_id`);
        searchCriteria.push(`searchCriteria[filterGroups][1][filters][0][value]=${options.ids.join(',')}`);
        searchCriteria.push(`searchCriteria[filterGroups][1][filters][0][conditionType]=in`);
      }

      // Filter by category
      if (options.category) {
        const categoryId = await this.getCategoryIdByName(options.category);
        if (categoryId) {
          searchCriteria.push(`searchCriteria[filterGroups][2][filters][0][field]=category_id`);
          searchCriteria.push(`searchCriteria[filterGroups][2][filters][0][value]=${categoryId}`);
          searchCriteria.push(`searchCriteria[filterGroups][2][filters][0][conditionType]=eq`);
        }
      }

      // Filter by stock status
      if (options.includeOutOfStock === false) {
        searchCriteria.push(`searchCriteria[filterGroups][3][filters][0][field]=quantity_and_stock_status`);
        searchCriteria.push(`searchCriteria[filterGroups][3][filters][0][value]=1`);
        searchCriteria.push(`searchCriteria[filterGroups][3][filters][0][conditionType]=eq`);
      }

      // Complete API URL
      apiUrl = `${apiUrl}?${searchCriteria.join('&')}`;

      // Make API request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Magento API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const products = data.items || [];
      const totalCount = data.total_count || 0;

      return {
        products,
        pagination: {
          currentPage: options.page || 1,
          totalPages: Math.ceil(totalCount / (options.limit || 20)),
          totalItems: totalCount,
          perPage: options.limit || 20,
        },
      };
    } catch (error) {
      console.error('Error fetching products from Magento:', error);
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
   * Get all categories from Magento
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Magento search service not initialized');
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Failed to authenticate with Magento API');
      }

      const apiUrl = `${this.config.storeUrl}/rest/V1/categories`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Magento API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Extract category names from the tree structure
      const categories: string[] = [];
      const extractCategories = (node: any) => {
        if (node.name && node.level > 0) {
          // Skip root category
          categories.push(node.name);
        }
        if (node.children_data && node.children_data.length > 0) {
          node.children_data.forEach((child: any) => extractCategories(child));
        }
      };

      extractCategories(data);
      return categories;
    } catch (error) {
      console.error('Error fetching categories from Magento:', error);
      return [];
    }
  }

  /**
   * Get category ID by name - helper function for Magento
   */
  private async getCategoryIdByName(categoryName: string): Promise<string | null> {
    if (!this.isInitialized()) {
      throw new Error('Magento search service not initialized');
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('Failed to authenticate with Magento API');
      }

      const apiUrl = `${this.config.storeUrl}/rest/V1/categories/list?searchCriteria[filterGroups][0][filters][0][field]=name&searchCriteria[filterGroups][0][filters][0][value]=${categoryName}&searchCriteria[filterGroups][0][filters][0][conditionType]=eq`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Magento API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const categories = data.items || [];

      if (categories.length > 0) {
        return categories[0].id.toString();
      }

      return null;
    } catch (error) {
      console.error('Error finding category ID by name in Magento:', error);
      return null;
    }
  }

  /**
   * Map Magento-specific product data to standard format
   */
  protected mapToSearchProduct(product: any): SearchProduct {
    // Get image URL
    let imageUrl = '';
    if (product.media_gallery_entries && product.media_gallery_entries.length > 0) {
      const entry = product.media_gallery_entries[0];
      imageUrl = `${this.config.storeUrl}/pub/media/catalog/product${entry.file}`;
    }

    // Get category information
    const categories = product.custom_attributes?.find((attr: any) => attr.attribute_code === 'category_names')?.value?.split(',') || [];

    return {
      id: product.id || product.sku || '',
      name: product.name || '',
      description: product.description || product.short_description || '',
      price: parseFloat(product.price || 0),
      imageUrl: imageUrl,
      category: categories.length > 0 ? categories[0] : undefined,
      source: 'ecommerce',
      inStock: Boolean(
        product.status === 1 && (product.quantity_and_stock_status?.is_in_stock || product.extension_attributes?.stock_item?.is_in_stock)
      ),
      quantity: product.extension_attributes?.stock_item?.qty || 0,
      sku: product.sku || '',
      originalProduct: {
        productUrl: `${this.config.storeUrl}/catalog/product/view/id/${product.id}`,
        compareAtPrice: product.special_price ? parseFloat(product.price || 0) : null,
        categories,
        vendor: '',
      },
    };
  }

  /**
   * Get authorization token for Magento API
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      // Check if we have a valid token already
      const now = new Date();
      if (this.accessToken && this.tokenExpiration && this.tokenExpiration > now) {
        return this.accessToken;
      }

      // Authenticate and get new token
      const tokenUrl = `${this.config.storeUrl}/rest/V1/integration/admin/token`;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      });

      if (!response.ok) {
        console.error('Failed to get Magento authentication token', await response.text());
        return null;
      }

      // Parse token (comes as a string with quotes)
      const token = await response.text();
      this.accessToken = token.replace(/"/g, '');

      // Set token expiration (typically 4 hours for Magento)
      this.tokenExpiration = new Date();
      this.tokenExpiration.setHours(this.tokenExpiration.getHours() + 4);

      return this.accessToken;
    } catch (error) {
      console.error('Error getting Magento authentication token:', error);
      return null;
    }
  }
}
