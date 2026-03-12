/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

/**
 * Sylius-specific implementation of the search service
 */
export class SyliusSearchService extends BaseSearchService {
  private apiClient = SyliusApiClient.getInstance();
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

  /**
   * Create a new Sylius search service
   * @param config Configuration for Sylius API
   */
  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }

  /**
   * Initialize the Sylius search service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.apiUrl = this.config.apiUrl || process.env.SYLIUS_API_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.SYLIUS_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SYLIUS_API_SECRET || '';

      if (!this.config.apiUrl || !this.config.apiKey || !this.config.apiSecret) {
        this.logger.warn({ message: 'Missing Sylius API configuration' });
        return false;
      }

      // Configure and initialize the shared Sylius client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.apiUrl as string,
          apiKey: this.config.apiKey as string,
          apiSecret: this.config.apiSecret as string,
          accessToken: this.config.accessToken as string,
        });
        await this.apiClient.initialize();
      }

      // Test connection with a simple API call
      try {
        await this.apiClient.get('products');
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Sylius API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error({ message: 'Error initializing Sylius search service' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get configuration requirements for Sylius
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiUrl', 'apiKey', 'apiSecret'],
      optional: [],
      description: 'Sylius requires API URL, API key and secret for authentication',
    };
  }

  /**
   * Search for products in Sylius
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    try {
      if (!this.isInitialized()) {
        this.logger.warn({ message: 'Sylius search service not initialized. Cannot perform search.' });
        return [];
      }

      // Convert search options to product query options format
      const queryOptions = this.mapToProductQueryOptions(query, options);

      // Get products from Sylius
      const response = await this.getProducts(queryOptions);

      if (response && response.products) {
        return response.products.map(product => this.mapToSearchProduct(product));
      }

      return [];
    } catch (error) {
      this.logger.error({ message: 'Error searching Sylius products' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get products from Sylius with filtering
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Sylius search service not initialized');
    }

    try {
      // Build query parameters for Sylius API
      const queryParams = new URLSearchParams();

      // Sylius uses itemsPerPage and page for pagination
      if (options.limit) {
        queryParams.append('itemsPerPage', options.limit.toString());
      }

      if (options.page) {
        queryParams.append('page', options.page.toString());
      }

      // Sylius uses 'search[terms]' for product search
      if (options.search) {
        queryParams.append('search[name]', options.search);
      }

      // For specific product IDs
      if (options.ids && options.ids.length > 0) {
        options.ids.forEach(id => {
          queryParams.append('search[code][]', id);
        });
      }

      // For filtering by category
      if (options.category) {
        queryParams.append('search[productTaxons.taxon.code]', options.category.toLowerCase().replace(/\s+/g, '-'));
      }

      // In-stock filtering
      if (options.includeOutOfStock === false) {
        queryParams.append('search[enabled]', '1');
      }

      // API endpoint with query parameters
      const data = await this.apiClient.get<any>(`products?${queryParams.toString()}`);

      return {
        products: data['hydra:member'] || [],
        pagination: {
          currentPage: options.page || 1,
          totalPages: Math.ceil((data['hydra:totalItems'] || 0) / (options.limit || 30)),
          totalItems: data['hydra:totalItems'] || 0,
          perPage: options.limit || 30,
        },
      };
    } catch (error) {
      this.logger.error({ message: 'Error fetching products from Sylius' }, error instanceof Error ? error : new Error(String(error)));
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
   * Get all categories from Sylius (taxons in Sylius terminology)
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Sylius search service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>('taxons');
      return (data['hydra:member'] || [])
        .filter((taxon: any) => taxon.level > 0) // Filter out root taxons
        .map((taxon: any) => taxon.name);
    } catch (error) {
      this.logger.error({ message: 'Error fetching categories from Sylius' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Map Sylius-specific product data to standard format
   */
  protected mapToSearchProduct(product: any): SearchProduct {
    // Get categories from product taxons
    const categories = product.productTaxons?.map((pt: any) => pt.taxon.name) || [];

    // Get image URL from first product image
    const imageUrl = product.images && product.images.length > 0 ? `${this.config.apiUrl}/media/image/${product.images[0].path}` : '';

    // Calculate if product is in stock based on variants
    const inStock = product.enabled === true && (product.variants?.some((variant: any) => variant.onHand > 0) || false);

    // Calculate total quantity from all variants
    const quantity = product.variants?.reduce((sum: number, variant: any) => sum + (variant.onHand || 0), 0) || 0;

    // Map to standard SearchProduct format
    return {
      id: product.code || product.id || '',
      name: product.name || '',
      description: product.description || '',
      price: parseFloat(product.price || 0) / 100, // Sylius usually stores prices in cents
      imageUrl: imageUrl,
      category: categories.length > 0 ? categories[0] : undefined,
      source: 'ecommerce',
      inStock: inStock,
      quantity: quantity,
      sku: product.code || '',
      // Store additional Sylius-specific data in originalProduct
      originalProduct: {
        url: `${this.config.apiUrl}/en_US/products/${product.slug}`,
        categories: categories,
        vendor: '',
        variants:
          product.variants?.map((variant: any) => ({
            id: variant.code,
            name: variant.name,
            price: parseFloat(variant.price || 0) / 100,
            available: variant.onHand > 0,
          })) || [],
      },
    };
  }
}
