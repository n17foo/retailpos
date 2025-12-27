import { Product, ProductQueryOptions, ProductResult, SyncResult, ProductServiceInterface } from '../ProductServiceInterface';
import { PlatformProductServiceInterface } from './PlatformProductServiceInterface';

/**
 * Composite service that aggregates results from multiple platform-specific product services
 */
export class CompositeProductService implements ProductServiceInterface {
  private services: PlatformProductServiceInterface[] = [];

  /**
   * Create a new composite product service
   * @param services Array of platform-specific product services
   */
  constructor(services: PlatformProductServiceInterface[] = []) {
    this.services = services;
  }

  /**
   * Add a platform service to the composite
   * @param service The platform service to add
   */
  public addService(service: PlatformProductServiceInterface): void {
    this.services.push(service);
  }

  /**
   * Initialize all platform services
   * @returns Promise resolving to true if at least one service was initialized successfully
   */
  public async initialize(): Promise<boolean> {
    if (this.services.length === 0) {
      return false;
    }

    const results = await Promise.all(
      this.services.map(async service => {
        try {
          return await service.initialize();
        } catch (error) {
          console.error('Failed to initialize service:', error);
          return false;
        }
      })
    );

    return results.some(result => result === true);
  }

  /**
   * Get products from all platform services
   * @param options Options to filter the products
   * @returns Promise resolving to aggregated product results
   */
  public async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Get products from all services
    const results = await Promise.all(
      this.services.map(async service => {
        if (!service.isInitialized()) {
          return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } };
        }

        try {
          return await service.getProducts(options);
        } catch (error) {
          console.error('Error getting products from service:', error);
          return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } };
        }
      })
    );

    // Combine products from all services
    const allProducts: Product[] = results.flatMap(result => result.products);

    // Calculate combined pagination information
    const totalItems = results.reduce((sum, result) => sum + result.pagination.totalItems, 0);
    const perPage = options.limit || 10;
    const totalPages = Math.ceil(totalItems / perPage);
    const currentPage = options.page || 1;

    // Return combined results
    return {
      products: allProducts,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        perPage,
      },
    };
  }

  /**
   * Get a product by ID from any of the platform services
   * @param productId ID of the product to retrieve
   * @returns Promise resolving to the product or null if not found
   */
  public async getProductById(productId: string): Promise<Product | null> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Try to find the product in any of the services
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const product = await service.getProductById(productId);
        if (product) {
          return product;
        }
      } catch (error) {
        console.error(`Error getting product ${productId} from service:`, error);
      }
    }

    return null;
  }

  /**
   * Create a product in the first available platform service
   * @param product Product data to create
   * @returns Promise resolving to the created product
   */
  public async createProduct(product: Product): Promise<Product> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Find first available service
    const service = this.getFirstAvailableService();
    if (!service) {
      throw new Error('No available product service to create product');
    }

    // Create product
    return await service.createProduct(product);
  }

  /**
   * Update a product in the service that owns it
   * @param productId ID of the product to update
   * @param productData Updated product data
   * @returns Promise resolving to the updated product
   */
  public async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Find which service the product belongs to
    const existingProduct = await this.getProductById(productId);
    if (!existingProduct) {
      throw new Error(`Product with ID ${productId} not found`);
    }

    // Find the service that owns the product
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const product = await service.getProductById(productId);
        if (product) {
          // This service owns the product
          return await service.updateProduct(productId, productData);
        }
      } catch (error) {
        console.error(`Error updating product ${productId} in service:`, error);
      }
    }

    throw new Error(`No service available to update product ${productId}`);
  }

  /**
   * Delete a product from the service that owns it
   * @param productId ID of the product to delete
   * @returns Promise resolving to a boolean indicating success
   */
  public async deleteProduct(productId: string): Promise<boolean> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Find which service the product belongs to
    for (const service of this.services) {
      if (!service.isInitialized()) {
        continue;
      }

      try {
        const product = await service.getProductById(productId);
        if (product) {
          // This service owns the product
          return await service.deleteProduct(productId);
        }
      } catch (error) {
        console.error(`Error deleting product ${productId} from service:`, error);
      }
    }

    throw new Error(`Product with ID ${productId} not found for deletion`);
  }

  /**
   * Sync products across all platform services
   * @param products Products to sync
   * @returns Promise resolving to combined sync results
   */
  public async syncProducts(products: Product[]): Promise<SyncResult> {
    // Initialize services if they haven't been initialized yet
    await this.ensureInitialized();

    // Sync products across all services
    const results = await Promise.all(
      this.services.map(async service => {
        if (!service.isInitialized()) {
          return { successful: 0, failed: 0, errors: [] };
        }

        try {
          return await service.syncProducts(products);
        } catch (error) {
          console.error('Error syncing products with service:', error);
          return {
            successful: 0,
            failed: products.length,
            errors: products.map(p => ({
              productId: p.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            })),
          };
        }
      })
    );

    // Combine sync results
    return results.reduce(
      (combined, result) => {
        return {
          successful: combined.successful + result.successful,
          failed: combined.failed + result.failed,
          errors: [...combined.errors, ...result.errors],
        };
      },
      { successful: 0, failed: 0, errors: [] }
    );
  }

  /**
   * Get the first available initialized service
   * @returns The first available service or null if none are available
   */
  private getFirstAvailableService(): PlatformProductServiceInterface | null {
    return this.services.find(service => service.isInitialized()) || null;
  }

  /**
   * Ensure that all services are initialized
   */
  private async ensureInitialized(): Promise<void> {
    await Promise.all(
      this.services.map(async service => {
        if (!service.isInitialized()) {
          try {
            await service.initialize();
          } catch (error) {
            console.error('Failed to initialize service:', error);
          }
        }
      })
    );
  }
}
