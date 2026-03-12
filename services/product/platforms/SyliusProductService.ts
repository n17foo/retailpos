/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { SyliusApiClient } from '../../clients/sylius/SyliusApiClient';

/**
 * Sylius-specific implementation of the product service
 * Supports Sylius REST API
 */
export class SyliusProductService extends BaseProductService {
  private apiClient = SyliusApiClient.getInstance();

  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('SyliusProductService');
  }

  /**
   * Initialize the Sylius product service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration
      this.config.apiUrl = this.config.apiUrl || process.env.SYLIUS_API_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.SYLIUS_API_KEY || '';
      this.config.apiSecret = this.config.apiSecret || process.env.SYLIUS_API_SECRET || '';
      this.config.accessToken = this.config.accessToken || process.env.SYLIUS_ACCESS_TOKEN || '';
      this.config.apiVersion = this.config.apiVersion || process.env.SYLIUS_API_VERSION || '';

      if (!this.config.apiUrl) {
        this.logger.warn('Missing Sylius API URL configuration');
        return false;
      }

      // Configure and initialize the shared Sylius client
      if (!this.apiClient.isInitialized()) {
        this.apiClient.configure({
          storeUrl: this.config.apiUrl as string,
          accessToken: this.config.accessToken as string,
          apiKey: this.config.apiKey as string,
          apiSecret: this.config.apiSecret as string,
          apiVersion: this.config.apiVersion as string,
        });
        await this.apiClient.initialize();
      }

      // Test connection
      try {
        await this.apiClient.get('products', { limit: '1' });
        this.initialized = true;
        return true;
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Sylius API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Sylius product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get configuration requirements
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['apiUrl'],
      optional: ['apiKey', 'apiSecret', 'accessToken', 'apiVersion'],
      description: 'Sylius requires API URL and either OAuth credentials or access token',
    };
  }

  /**
   * Get products from Sylius
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Sylius product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
      try {
        const params = new URLSearchParams();
        params.append('limit', String(options.limit || 20));
        params.append('page', String(options.page || 1));

        if (options.search) {
          params.append('search', options.search);
        }

        const data = await this.apiClient.get<any>(`products?${params.toString()}`);

        // Sylius returns products in _embedded.items or directly as array
        const items = data._embedded?.items || data.items || data || [];
        const products = items.map((syliusProduct: any) => this.mapToProduct(syliusProduct));

        return {
          products,
          pagination: {
            currentPage: data.page || options.page || 1,
            totalPages: data.pages || Math.ceil((data.total || items.length) / (options.limit || 20)),
            totalItems: data.total || items.length,
            perPage: options.limit || 20,
          },
        };
      } catch (error) {
        this.logger.error({ message: 'Error fetching products from Sylius' }, error instanceof Error ? error : new Error(String(error)));
        return {
          products: [],
          pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit || 20 },
        };
      }
    });
  }

  /**
   * Get a single product by ID (code in Sylius)
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Sylius product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
      try {
        const syliusProduct = await this.apiClient.get<any>(`products/${productId}`);
        return this.mapToProduct(syliusProduct);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product ${productId} from Sylius` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  /**
   * Create a new product on Sylius
   */
  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Sylius product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
      try {
        const syliusProduct = this.mapToSyliusProduct(product);
        const createdProduct = await this.apiClient.post<any>('products', syliusProduct);
        return this.mapToProduct(createdProduct);
      } catch (error) {
        this.logger.error({ message: 'Error creating product on Sylius' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  /**
   * Update a product on Sylius
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Sylius product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
      try {
        const existingProduct = await this.getProductById(productId);
        if (!existingProduct) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        const updatedProduct = { ...existingProduct, ...productData };
        const syliusProduct = this.mapToSyliusProduct(updatedProduct);
        const updated = await this.apiClient.put<any>(`products/${productId}`, syliusProduct);
        return this.mapToProduct(updated);
      } catch (error) {
        this.logger.error(
          { message: `Error updating product ${productId} on Sylius` },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    });
  }

  /**
   * Delete a product from Sylius
   */
  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Sylius product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.SYLIUS, async () => {
      try {
        await this.apiClient.delete(`products/${productId}`);
        return true;
      } catch (error) {
        this.logger.error(
          { message: `Error deleting product ${productId} from Sylius` },
          error instanceof Error ? error : new Error(String(error))
        );
        return false;
      }
    });
  }

  /**
   * Sync products with Sylius
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('Sylius product service not initialized');
    }

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const product of products) {
      try {
        const existing = await this.getProductById(product.id);

        if (existing) {
          await this.updateProduct(product.id, product);
        } else {
          await this.createProduct(product);
        }

        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Map Sylius product to our format
   */
  protected mapToProduct(syliusProduct: any): Product {
    // Extract variants
    const variants = (syliusProduct.variants || []).map((variant: any) => ({
      id: variant.code || String(variant.id),
      title: variant.name || 'Default',
      sku: variant.code || '',
      barcode: variant.barcode,
      price: variant.price ? variant.price / 100 : 0, // Sylius stores prices in cents
      inventoryQuantity: variant.onHand || 0,
      weight: variant.weight,
      weightUnit: 'g' as const,
    }));

    // If no variants, create default
    if (variants.length === 0) {
      variants.push({
        id: syliusProduct.code || String(syliusProduct.id),
        title: 'Default',
        sku: syliusProduct.code || '',
        price: 0,
        inventoryQuantity: 0,
      });
    }

    // Extract images
    const images = (syliusProduct.images || []).map((image: any) => ({
      id: String(image.id),
      url: image.path || image.url || '',
      alt: '',
      position: image.position,
    }));

    return {
      id: syliusProduct.code || String(syliusProduct.id),
      title: syliusProduct.name || syliusProduct.translations?.en?.name || '',
      description: syliusProduct.description || syliusProduct.translations?.en?.description || '',
      vendor: '',
      productType: syliusProduct.mainTaxon?.name || '',
      tags: (syliusProduct.productTaxons || []).map((t: any) => t.taxon?.name || ''),
      options: [],
      variants,
      images,
      createdAt: syliusProduct.createdAt ? new Date(syliusProduct.createdAt) : undefined,
      updatedAt: syliusProduct.updatedAt ? new Date(syliusProduct.updatedAt) : undefined,
    };
  }

  /**
   * Map our product format to Sylius format
   */
  private mapToSyliusProduct(product: Product): any {
    const primaryVariant = product.variants[0] || { sku: '', price: 0 };

    return {
      code: primaryVariant.sku || product.id,
      translations: {
        en: {
          name: product.title,
          description: product.description || '',
          slug: product.title.toLowerCase().replace(/\s+/g, '-'),
        },
      },
      enabled: true,
      variants: product.variants.map(variant => ({
        code: variant.sku,
        translations: {
          en: {
            name: variant.title || product.title,
          },
        },
        price: Math.round((variant.price || 0) * 100), // Convert to cents
        onHand: variant.inventoryQuantity || 0,
        tracked: true,
      })),
    };
  }
}
