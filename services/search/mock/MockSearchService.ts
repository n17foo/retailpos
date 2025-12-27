import { SearchOptions, SearchProduct } from '../searchServiceInterface';
import { ProductQueryOptions, Product, ProductResult } from '../../product/ProductServiceInterface';
import { PlatformConfigRequirements, PlatformSearchConfig } from '../platforms/PlatformSearchServiceInterface';
import { BaseSearchService } from '../platforms/BaseSearchService';

/**
 * Mock search service for testing and development
 */
export class MockSearchService extends BaseSearchService {
  // Use declare to tell TypeScript this exists without redefining it
  // The config property is inherited from BaseSearchService

  // Mock product data
  private mockProducts: Product[] = [
    {
      id: 'mock-1',
      title: 'Mock T-Shirt',
      description: 'A comfortable mock t-shirt for testing',
      vendor: 'Mock Apparel',
      productType: 'Clothing',
      tags: ['cotton', 'casual', 't-shirt'],
      options: [{ name: 'Size', values: ['Small', 'Medium', 'Large'] }],
      variants: [
        {
          id: 'v1',
          title: 'Small',
          price: 19.99,
          compareAtPrice: 24.99,
          inventoryQuantity: 10,
          options: ['Small'],
        },
        {
          id: 'v2',
          title: 'Medium',
          price: 19.99,
          compareAtPrice: 24.99,
          inventoryQuantity: 10,
          options: ['Medium'],
        },
        {
          id: 'v3',
          title: 'Large',
          price: 19.99,
          compareAtPrice: 24.99,
          inventoryQuantity: 10,
          options: ['Large'],
        },
      ],
      images: [{ id: 'img-mock-1', url: 'https://picsum.photos/200/300' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'mock-2',
      title: 'Mock Jeans',
      description: 'Classic mock jeans that never go out of style',
      vendor: 'Mock Apparel',
      productType: 'Clothing',
      tags: ['denim', 'casual', 'jeans'],
      options: [{ name: 'Size', values: ['30x32', '32x32'] }],
      images: [{ id: 'img2', url: 'https://picsum.photos/200/300?random=2' }],
      variants: [
        {
          id: 'v4',
          title: '30x32',
          price: 49.99,
          compareAtPrice: 59.99,
          inventoryQuantity: 10,
          options: ['30x32'],
        },
        {
          id: 'v5',
          title: '32x32',
          price: 49.99,
          compareAtPrice: 59.99,
          inventoryQuantity: 10,
          options: ['32x32'],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'mock-3',
      title: 'Mock Hoodie',
      description: 'Warm mock hoodie for cold days',
      vendor: 'Mock Apparel',
      productType: 'Clothing',
      tags: ['cotton', 'casual', 'warm'],
      options: [{ name: 'Size', values: ['Small', 'Medium', 'Large'] }],
      images: [{ id: 'img3', url: 'https://picsum.photos/200/300?random=3' }],
      variants: [
        {
          id: 'v6',
          title: 'Small',
          price: 39.99,
          inventoryQuantity: 10,
          options: ['Small'],
        },
        {
          id: 'v7',
          title: 'Medium',
          price: 39.99,
          inventoryQuantity: 10,
          options: ['Medium'],
        },
        {
          id: 'v8',
          title: 'Large',
          price: 39.99,
          inventoryQuantity: 10,
          options: ['Large'],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'mock-4',
      title: 'Mock Sneakers',
      description: 'Comfortable mock sneakers for everyday wear',
      vendor: 'Mock Footwear',
      productType: 'Shoes',
      tags: ['casual', 'comfortable'],
      options: [{ name: 'Size', values: ['US 8', 'US 9', 'US 10', 'US 11'] }],
      images: [{ id: 'img4', url: 'https://picsum.photos/200/300?random=4' }],
      variants: [
        {
          id: 'v9',
          title: 'US 8',
          price: 79.99,
          compareAtPrice: 89.99,
          inventoryQuantity: 10,
          options: ['US 8'],
        },
        {
          id: 'v10',
          title: 'US 9',
          price: 79.99,
          compareAtPrice: 89.99,
          inventoryQuantity: 10,
          options: ['US 9'],
        },
        {
          id: 'v11',
          title: 'US 10',
          price: 79.99,
          compareAtPrice: 89.99,
          inventoryQuantity: 10,
          options: ['US 10'],
        },
        {
          id: 'v12',
          title: 'US 11',
          price: 79.99,
          compareAtPrice: 89.99,
          inventoryQuantity: 10,
          options: ['US 11'],
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Mock categories
  private mockCategories: string[] = ['Clothing', 'T-Shirts', 'Jeans', 'Sweatshirts', 'Shoes', 'Sneakers'];

  /**
   * Create a new mock search service
   * @param config Optional configuration
   */
  constructor(config: PlatformSearchConfig = {}) {
    super(config);
  }

  /**
   * Initialize the mock search service
   */
  async initialize(): Promise<boolean> {
    // Simulate a small delay as if connecting to an API
    return new Promise(resolve => {
      setTimeout(() => {
        this.initialized = true;
        resolve(true);
      }, 100);
    });
  }

  /**
   * Get configuration requirements (none for mock service)
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: [],
      optional: ['mockDelay', 'mockFailure'],
      description: 'Mock search service for testing, supports optional mockDelay and mockFailure flags',
    };
  }

  /**
   * Search for products in the mock database
   */
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    // Check initialization
    if (!this.isInitialized()) {
      console.warn('Mock search service not initialized');
      return [];
    }

    // Simulate a delay if configured
    if (this.config.mockDelay) {
      await new Promise(resolve => setTimeout(resolve, Number(this.config.mockDelay) || 500));
    }

    // Simulate failure if configured
    if (this.config.mockFailure) {
      throw new Error('Mock search failure');
    }

    // Filter products by search query
    const filteredProducts = this.mockProducts.filter(product => {
      // Simple search implementation for mocking
      const searchString = query.toLowerCase();
      return (
        product.title.toLowerCase().includes(searchString) ||
        product.description?.toLowerCase().includes(searchString) ||
        false ||
        product.tags?.some(tag => tag.toLowerCase().includes(searchString)) ||
        false ||
        product.productType?.toLowerCase().includes(searchString) ||
        false ||
        product.vendor?.toLowerCase().includes(searchString) ||
        false
      );
    });

    // Map to search products
    return filteredProducts.map(product => this.mapToSearchProduct(product));
  }

  /**
   * Get products from the mock database
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Mock search service not initialized');
    }

    // Apply filters
    let filteredProducts = [...this.mockProducts];

    // Filter by search query
    if (options.search) {
      const searchString = options.search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        product => product.title.toLowerCase().includes(searchString) || product.description.toLowerCase().includes(searchString)
      );
    }

    // Filter by specific IDs
    if (options.ids && options.ids.length > 0) {
      filteredProducts = filteredProducts.filter(product => options.ids!.includes(product.id));
    }

    // Filter by category
    if (options.category) {
      filteredProducts = filteredProducts.filter(product => product.productType === options.category);
    }

    // Filter out of stock if required
    if (options.includeOutOfStock === false) {
      filteredProducts = filteredProducts.filter(product => product.variants.some(variant => variant.inventoryQuantity > 0));
    }

    // Handle pagination
    const page = options.page || 1;
    const limit = options.limit || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Get paginated products
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    // Return product result
    return {
      products: paginatedProducts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredProducts.length / limit),
        totalItems: filteredProducts.length,
        perPage: limit,
      },
    };
  }

  /**
   * Get all categories from the mock database
   */
  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Mock search service not initialized');
    }

    return this.mockCategories;
  }

  /**
   * Map a Product to a SearchProduct for search results
   * @param product The product to map
   * @returns The mapped SearchProduct
   */
  protected mapToSearchProduct(product: Product): SearchProduct {
    // Find the primary variant (first one with inventory, or the first one)
    const primaryVariant = product.variants.find(v => v.inventoryQuantity > 0) || product.variants[0] || null;

    // Get the image URL from the first image
    const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : undefined;

    // Calculate if product is in stock based on variants inventory quantity
    const inStock = product.variants.some(variant => variant.inventoryQuantity > 0);

    // Calculate total inventory quantity across all variants
    const quantity = product.variants.reduce((total, variant) => total + (variant.inventoryQuantity || 0), 0);

    return {
      id: product.id,
      name: product.title,
      description: product.description,
      price: primaryVariant ? primaryVariant.price : 0,
      imageUrl: imageUrl,
      category: product.productType,
      source: 'ecommerce',
      inStock: inStock,
      quantity: quantity,
      sku: primaryVariant?.sku,
      barcode: primaryVariant?.barcode,
      originalProduct: product,
    };
  }
}
