import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductServiceInterface, PlatformConfigRequirements, PlatformProductConfig } from './PlatformProductServiceInterface';
import { LoggerFactory } from '../../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRODUCTS_STORAGE_KEY = 'custom_local_products';
const MENU_URL_STORAGE_KEY = 'custom_menu_url';
const LAST_SYNC_KEY = 'custom_last_menu_sync';

/**
 * Custom/Local product service for offline-first POS operation
 * Downloads menu from a public URL and stores locally
 * All operations are local-only, no online sync
 */
export class CustomProductService implements PlatformProductServiceInterface {
  private initialized: boolean = false;
  private products: Product[] = [];
  private menuUrl: string = '';
  private logger = LoggerFactory.getInstance().createLogger('CustomProductService');

  constructor(config: PlatformProductConfig = {}) {
    if (config.menuUrl) {
      this.menuUrl = config.menuUrl;
    }
  }

  /**
   * Initialize the custom product service
   * Loads products from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      // Load menu URL from storage if not provided
      if (!this.menuUrl) {
        const storedUrl = await AsyncStorage.getItem(MENU_URL_STORAGE_KEY);
        if (storedUrl) {
          this.menuUrl = storedUrl;
        }
      }

      // Load cached products from local storage
      const storedProducts = await AsyncStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (storedProducts) {
        this.products = JSON.parse(storedProducts);
        this.logger.info(`Loaded ${this.products.length} products from local storage`);
      }

      this.initialized = true;
      this.logger.info('Custom product service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing custom product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration requirements for custom platform
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['menuUrl'],
      optional: ['refreshInterval'],
      description: 'Custom local-only mode. Provide a public URL to download your menu/products JSON.',
    };
  }

  /**
   * Set the menu URL and save to storage
   */
  async setMenuUrl(url: string): Promise<void> {
    this.menuUrl = url;
    await AsyncStorage.setItem(MENU_URL_STORAGE_KEY, url);
    this.logger.info(`Menu URL set: ${url}`);
  }

  /**
   * Download menu from the configured public URL
   * Expected JSON format:
   * {
   *   "products": [...],
   *   "categories": [...]
   * }
   */
  async downloadMenu(): Promise<{ products: Product[]; categories: any[] }> {
    if (!this.menuUrl) {
      throw new Error('Menu URL not configured. Please set the menu download URL first.');
    }

    try {
      this.logger.info(`Downloading menu from: ${this.menuUrl}`);

      const response = await fetch(this.menuUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download menu: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse products from response
      const rawProducts = data.products || data.items || data.menu || [];
      const products = rawProducts.map((item: any) => this.mapToProduct(item));

      // Parse categories from response
      const categories = data.categories || [];

      // Store products locally
      this.products = products;
      await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

      this.logger.info(`Downloaded ${products.length} products and ${categories.length} categories`);

      return { products, categories };
    } catch (error) {
      this.logger.error({ message: 'Error downloading menu' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return lastSync ? new Date(lastSync) : null;
  }

  /**
   * Get products from local storage
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    let filteredProducts = [...this.products];

    // Apply category filter
    if (options.category) {
      filteredProducts = filteredProducts.filter(p => p.productType === options.category || p.tags?.includes(options.category));
    }

    // Apply search filter
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        p =>
          p.title.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower) ||
          p.variants.some(v => v.sku?.toLowerCase().includes(searchLower))
      );
    }

    // Apply ID filter
    if (options.ids && options.ids.length > 0) {
      filteredProducts = filteredProducts.filter(p => options.ids!.includes(p.id));
    }

    // Apply out of stock filter
    if (!options.includeOutOfStock) {
      filteredProducts = filteredProducts.filter(p => p.variants.some(v => v.inventoryQuantity > 0));
    }

    // Apply pagination
    const page = options.page || 1;
    const limit = options.limit || 50;
    const startIndex = (page - 1) * limit;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

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
   * Get a single product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.products.find(p => p.id === productId) || null;
  }

  /**
   * Create a new product (local only)
   */
  async createProduct(product: Product): Promise<Product> {
    if (!this.initialized) {
      await this.initialize();
    }

    const newProduct = {
      ...product,
      id: product.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.products.push(newProduct);
    await this.saveProductsToStorage();

    this.logger.info(`Created local product: ${newProduct.title}`);
    return newProduct;
  }

  /**
   * Update an existing product (local only)
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.initialized) {
      await this.initialize();
    }

    const index = this.products.findIndex(p => p.id === productId);
    if (index === -1) {
      throw new Error(`Product not found: ${productId}`);
    }

    const updatedProduct = {
      ...this.products[index],
      ...productData,
      id: productId, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    this.products[index] = updatedProduct;
    await this.saveProductsToStorage();

    this.logger.info(`Updated local product: ${updatedProduct.title}`);
    return updatedProduct;
  }

  /**
   * Delete a product (local only)
   */
  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const index = this.products.findIndex(p => p.id === productId);
    if (index === -1) {
      return false;
    }

    this.products.splice(index, 1);
    await this.saveProductsToStorage();

    this.logger.info(`Deleted local product: ${productId}`);
    return true;
  }

  /**
   * Sync products - In custom mode, this just saves to local storage
   * No online sync is performed
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    try {
      // In custom/local mode, sync just means saving to local storage
      this.products = products;
      await this.saveProductsToStorage();

      this.logger.info(`Synced ${products.length} products to local storage`);

      return {
        successful: products.length,
        failed: 0,
        errors: [],
      };
    } catch (error) {
      this.logger.error({ message: 'Error syncing products locally' }, error instanceof Error ? error : new Error(String(error)));

      return {
        successful: 0,
        failed: products.length,
        errors: products.map(p => ({
          productId: p.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  }

  /**
   * Save products to local storage
   */
  private async saveProductsToStorage(): Promise<void> {
    await AsyncStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(this.products));
  }

  /**
   * Map external product format to standard Product format
   */
  private mapToProduct(item: any): Product {
    return {
      id: item.id?.toString() || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: item.title || item.name || 'Untitled Product',
      description: item.description || '',
      vendor: item.vendor || item.brand || '',
      productType: item.category || item.productType || item.type || '',
      tags: item.tags || [],
      options: item.options || [],
      variants: item.variants || [
        {
          id: item.id?.toString() || `var-${Date.now()}`,
          title: 'Default',
          sku: item.sku || '',
          barcode: item.barcode || '',
          price: parseFloat(item.price) || 0,
          compareAtPrice: item.compareAtPrice ? parseFloat(item.compareAtPrice) : undefined,
          inventoryQuantity: parseInt(item.stock) || parseInt(item.quantity) || parseInt(item.inventoryQuantity) || 999,
        },
      ],
      images:
        item.images?.map((img: any, index: number) => ({
          id: img.id || `img-${index}`,
          url: typeof img === 'string' ? img : img.url || img.src || '',
          alt: img.alt || '',
        })) ||
        (item.image
          ? [
              {
                id: 'main',
                url: typeof item.image === 'string' ? item.image : item.image.url || item.image.src || '',
                alt: '',
              },
            ]
          : []),
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    };
  }

  /**
   * Clear all local products
   */
  async clearLocalProducts(): Promise<void> {
    this.products = [];
    await AsyncStorage.removeItem(PRODUCTS_STORAGE_KEY);
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    this.logger.info('Cleared all local products');
  }
}
