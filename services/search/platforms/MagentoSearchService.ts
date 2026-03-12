/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';
import { MagentoApiClient } from '../../clients/magento/MagentoApiClient';

/**
 * Magento-specific implementation of the search service
 */
export class MagentoSearchService extends BaseSearchService {
  private apiClient = MagentoApiClient.getInstance();
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

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
        this.logger.warn({ message: 'Missing Magento API configuration' });
        return false;
      }

      // Configure and initialize the shared Magento client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.storeUrl as string,
          accessToken: this.config.accessToken as string,
          username: this.config.username as string,
          password: this.config.password as string,
        });
        await this.apiClient.initialize();
      }

      // Test connection with a simple API call
      try {
        await this.apiClient.get('products', { 'searchCriteria[pageSize]': '1' });
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Magento API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing Magento search service' },
        error instanceof Error ? error : new Error(String(error))
      );
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
        this.logger.warn({ message: 'Magento search service not initialized. Cannot perform search.' });
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
      this.logger.error({ message: 'Error searching Magento products' }, error instanceof Error ? error : new Error(String(error)));
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
      // Build Magento search criteria
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

      // Make API request
      const data = await this.apiClient.get<{ items: any[]; total_count: number }>(`products?${searchCriteria.join('&')}`);
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
      this.logger.error({ message: 'Error fetching products from Magento' }, error instanceof Error ? error : new Error(String(error)));
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
   * Search Magento products by barcode using the barcode custom attribute filter.
   * Uses /rest/V1/products with searchCriteria filtering on the 'barcode' attribute.
   */
  async searchByBarcode(barcode: string): Promise<SearchProduct[]> {
    if (!this.isInitialized()) return [];

    try {
      const criteria = [
        `searchCriteria[filterGroups][0][filters][0][field]=barcode`,
        `searchCriteria[filterGroups][0][filters][0][value]=${encodeURIComponent(barcode)}`,
        `searchCriteria[filterGroups][0][filters][0][conditionType]=eq`,
        `searchCriteria[pageSize]=5`,
      ].join('&');

      const data = await this.apiClient.get<{ items: any[] }>(`products?${criteria}`);
      const items = data.items || [];
      const result = await this.getProducts({ ids: items.map((p: any) => p.id) });
      return result.products.map(p => this.mapToSearchProduct(p));
    } catch (error) {
      this.logger.error(
        { message: `Magento barcode search failed for ${barcode}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
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
      const data = await this.apiClient.get<any>('categories');

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
      this.logger.error({ message: 'Error fetching categories from Magento' }, error instanceof Error ? error : new Error(String(error)));
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
      const data = await this.apiClient.get<{ items: any[] }>(
        `categories/list?searchCriteria[filterGroups][0][filters][0][field]=name&searchCriteria[filterGroups][0][filters][0][value]=${categoryName}&searchCriteria[filterGroups][0][filters][0][conditionType]=eq`
      );
      const categories = data.items || [];

      if (categories.length > 0) {
        return categories[0].id.toString();
      }

      return null;
    } catch (error) {
      this.logger.error(
        { message: 'Error finding category ID by name in Magento' },
        error instanceof Error ? error : new Error(String(error))
      );
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
}
