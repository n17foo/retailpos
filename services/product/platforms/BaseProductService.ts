import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductServiceInterface, PlatformConfigRequirements, PlatformProductConfig } from './PlatformProductServiceInterface';
import { LoggerFactory } from '../../logger';

/**
 * Base abstract class for platform-specific product service implementations
 * Provides common functionality for all platform product services
 */
export abstract class BaseProductService implements PlatformProductServiceInterface {
  protected initialized: boolean = false;
  protected config: PlatformProductConfig;
  protected logger = LoggerFactory.getInstance().createLogger('BaseProductService');

  /**
   * Creates a new platform product service
   * @param config Platform-specific configuration
   */
  constructor(config: PlatformProductConfig = {}) {
    this.config = config;
  }

  /**
   * Initialize the product service
   * Each platform must implement this to handle platform-specific initialization
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration requirements for this platform
   * Each platform must implement this to specify its required config fields
   */
  abstract getConfigRequirements(): PlatformConfigRequirements;

  /**
   * Get products from the platform with specific filtering options
   * Each platform must implement this with its specific API calls
   */
  abstract getProducts(options: ProductQueryOptions): Promise<ProductResult>;

  /**
   * Get a single product by ID
   * Each platform must implement this with its specific API calls
   */
  abstract getProductById(productId: string): Promise<Product | null>;

  /**
   * Create a new product
   * Each platform must implement this with its specific API calls
   */
  abstract createProduct(product: Product): Promise<Product>;

  /**
   * Update an existing product
   * Each platform must implement this with its specific API calls
   */
  abstract updateProduct(productId: string, productData: Partial<Product>): Promise<Product>;

  /**
   * Delete a product
   * Each platform must implement this with its specific API calls
   */
  abstract deleteProduct(productId: string): Promise<boolean>;

  /**
   * Sync products between platforms or systems
   * Each platform must implement this with its specific logic
   */
  abstract syncProducts(products: Product[]): Promise<SyncResult>;

  /**
   * Create authorization headers for API requests
   * Utility method for platform implementations
   *
   * @returns Authorization headers for API requests
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    return {};
  }

  /**
   * Map a platform-specific product to the standard Product format
   * This can be overridden by platform-specific implementations
   */
  protected mapToProduct(platformProduct: any): Product {
    // Default implementation - should be overridden by platform services
    return {
      id: platformProduct.id || '',
      title: platformProduct.title || platformProduct.name || '',
      description: platformProduct.description || '',
      vendor: platformProduct.vendor || '',
      productType: platformProduct.product_type || platformProduct.productType || '',
      tags: platformProduct.tags || [],
      options: platformProduct.options || [],
      variants: platformProduct.variants || [
        {
          id: platformProduct.id || '',
          title: 'Default',
          price: platformProduct.price || 0,
          inventoryQuantity: platformProduct.inventory_quantity || platformProduct.inventoryQuantity || 0,
        },
      ],
      images: (platformProduct.images || []).map((img: any) => ({
        id: img.id || '',
        url: img.url || img.src || '',
        alt: img.alt || '',
      })),
      createdAt: platformProduct.created_at
        ? new Date(platformProduct.created_at)
        : platformProduct.createdAt
          ? new Date(platformProduct.createdAt)
          : new Date(),
      updatedAt: platformProduct.updated_at
        ? new Date(platformProduct.updated_at)
        : platformProduct.updatedAt
          ? new Date(platformProduct.updatedAt)
          : new Date(),
    };
  }
}
