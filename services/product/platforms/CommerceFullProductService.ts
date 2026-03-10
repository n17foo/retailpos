/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the product service.
 * Uses the CommerceFull REST API via the shared API client.
 *
 * Endpoint mapping:
 *   GET  /business/products           → getProducts
 *   GET  /business/products/:id       → getProductById
 *   POST /business/products           → createProduct
 *   PUT  /business/products/:id       → updateProduct
 *   DELETE /business/products/:id     → deleteProduct
 */
export class CommerceFullProductService extends BaseProductService {
  private apiClient: CommerceFullApiClient;

  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('CommerceFullProductService');
    this.apiClient = CommerceFullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommerceFullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();

      if (ok) {
        this.initialized = true;
      }
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize CommerceFull product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion'],
      description: 'CommerceFull product service requires store URL and API credentials',
    };
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull product service not initialized');
    }

    try {
      const params: Record<string, string> = {};
      if (options.limit) params.limit = String(options.limit);
      if (options.page) params.page = String(options.page);
      if (options.search) params.search = options.search;
      if (options.category) params.category = options.category;
      if (options.ids && options.ids.length > 0) params.ids = options.ids.join(',');

      const data = await this.apiClient.get<any>('/business/products', params);

      const products: Product[] = (data.data || data.products || data || []).map((p: any) => this.mapToProduct(p));

      const pagination = data.pagination || data.meta || {};
      return {
        products,
        pagination: {
          currentPage: pagination.currentPage || pagination.page || options.page || 1,
          totalPages: pagination.totalPages || pagination.pages || 1,
          totalItems: pagination.totalItems || pagination.total || products.length,
          perPage: pagination.perPage || pagination.limit || options.limit,
        },
      };
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching products from CommerceFull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit } };
    }
  }

  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull product service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/business/products/${productId}`);
      const product = data.data || data.product || data;
      return this.mapToProduct(product);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching product ${productId} from CommerceFull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull product service not initialized');
    }

    try {
      const body = this.mapToCommerceFullProduct(product);
      const data = await this.apiClient.post<any>('/business/products', body);
      return this.mapToProduct(data.data || data.product || data);
    } catch (error) {
      this.logger.error({ message: 'Error creating product on CommerceFull' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull product service not initialized');
    }

    try {
      const body = this.mapToCommerceFullProduct(productData as Product);
      const data = await this.apiClient.put<any>(`/business/products/${productId}`, body);
      return this.mapToProduct(data.data || data.product || data);
    } catch (error) {
      this.logger.error(
        { message: `Error updating product ${productId} on CommerceFull` },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull product service not initialized');
    }

    try {
      await this.apiClient.delete(`/business/products/${productId}`);
      return true;
    } catch (error) {
      this.logger.error(
        { message: `Error deleting product ${productId} from CommerceFull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull product service not initialized');
    }

    const result: SyncResult = { successful: 0, failed: 0, errors: [] };

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
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  protected mapToProduct(p: any): Product {
    if (!p) return { id: '', title: '', variants: [] };

    const variants =
      p.variants?.map((v: any) => ({
        id: String(v.variantId || v.id || ''),
        title: v.name || v.title || 'Default',
        sku: v.sku || '',
        barcode: v.barcode || '',
        price: parseFloat(v.price) || 0,
        compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : undefined,
        inventoryQuantity: v.inventoryQuantity ?? v.stockQuantity ?? 0,
        weight: v.weight,
        weightUnit: v.weightUnit,
        options: v.options || [],
      })) || [];

    const images =
      p.images?.map((img: any) => ({
        id: String(img.imageId || img.id || ''),
        url: img.url || img.src || '',
        alt: img.alt || '',
        position: img.position || img.sortOrder,
      })) || [];

    return {
      id: String(p.productId || p.id || ''),
      title: p.name || p.title || '',
      description: p.description || '',
      vendor: p.vendor || p.brand || '',
      productType: p.productType || p.type || '',
      tags: Array.isArray(p.tags)
        ? p.tags
        : p.tags
          ? String(p.tags)
              .split(',')
              .map((t: string) => t.trim())
          : [],
      options: p.options || [],
      variants,
      images,
      createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    };
  }

  private mapToCommerceFullProduct(product: Product | Partial<Product>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (product.title) body.name = product.title;
    if (product.description !== undefined) body.description = product.description;
    if (product.vendor) body.vendor = product.vendor;
    if (product.productType) body.productType = product.productType;
    if (product.tags) body.tags = product.tags;
    if (product.variants) {
      body.variants = product.variants.map(v => ({
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        inventoryQuantity: v.inventoryQuantity,
        weight: v.weight,
        weightUnit: v.weightUnit,
        options: v.options,
      }));
    }
    if (product.images) {
      body.images = product.images.map(img => ({
        url: img.url,
        alt: img.alt,
        position: img.position,
      }));
    }
    return body;
  }
}
