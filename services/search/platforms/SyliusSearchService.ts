/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { BaseSearchService } from './BaseSearchService';

/**
 * Sylius-specific implementation of the search service
 */
export class SyliusSearchService extends BaseSearchService {
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
        console.warn('Missing Sylius API configuration');
        return false;
      }

      // Test connection with a simple API call
      try {
        const apiUrl = `${this.config.apiUrl}/api/v1/products`;
        const response = await fetch(apiUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          console.error('Failed to connect to Sylius API', await response.text());
          return false;
        }
      } catch (error) {
        console.error('Error connecting to Sylius API:', error);
        return false;
      }
    } catch (error) {
      console.error('Error initializing Sylius search service:', error);
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
        console.warn('Sylius search service not initialized. Cannot perform search.');
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
      console.error('Error searching Sylius products:', error);
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
      const apiUrl = `${this.config.apiUrl}/api/v1/products?${queryParams.toString()}`;

      // Make API request
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Sylius API request failed with status ${response.status}`);
      }

      const data = await response.json();

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
      console.error('Error fetching products from Sylius:', error);
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
      const apiUrl = `${this.config.apiUrl}/api/v1/taxons`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Sylius API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return (data['hydra:member'] || [])
        .filter((taxon: any) => taxon.level > 0) // Filter out root taxons
        .map((taxon: any) => taxon.name);
    } catch (error) {
      console.error('Error fetching categories from Sylius:', error);
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

  /**
   * Get authorization headers for Sylius API
   */
  protected getAuthHeaders(): Record<string, string> {
    // For simplicity, using API key auth. In production, should use OAuth or JWT
    return {
      Authorization: `Bearer ${this.generateToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Generate a token for Sylius API authentication
   * Note: This is a simplified implementation. In production, use OAuth flow.
   */
  private generateToken(): string {
    const apiKey = this.config.apiKey as string;
    const apiSecret = this.config.apiSecret as string;

    // In a real implementation, this would make a token request to the Sylius OAuth endpoint
    // For demonstration purposes, we're returning a mock token
    return `${apiKey}_${apiSecret}`;
  }
}
