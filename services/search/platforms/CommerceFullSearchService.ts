/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { ProductResult, ProductQueryOptions } from '../../product/ProductServiceInterface';
import { PlatformSearchServiceInterface, PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { CommerceFullApiClient, CommerceFullConfig } from '../../clients/commercefull/CommerceFullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * CommerceFull platform implementation of the search service.
 *
 * Endpoint mapping:
 *   GET  /customer/products/search?q=...&categoryId=...&minPrice=...&maxPrice=...&inStock=...&sortBy=...&limit=...&page=...
 *        → searchPlatformProducts  (faceted search with filters)
 *   GET  /customer/products        → getProducts   (basic product listing)
 *   GET  /customer/categories      → getCategories (dedicated category list)
 */
export class CommerceFullSearchService implements PlatformSearchServiceInterface {
  private initialized = false;
  private config: PlatformSearchConfig = {};
  private apiClient: CommerceFullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommerceFullSearchService');

  constructor(config: PlatformSearchConfig = {}) {
    this.config = config;
    this.apiClient = CommerceFullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommerceFullConfig = {
        storeUrl: this.config.storeUrl || this.config.apiUrl,
        apiKey: this.config.apiKey,
        apiSecret: (this.config as any).apiSecret,
        apiVersion: (this.config as any).apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
      return ok;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize CommerceFull search service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion'],
      description: 'CommerceFull search service requires store URL and API credentials',
    };
  }

  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull search service not initialized');
    }

    try {
      const params: Record<string, string> = { q: query };
      if (options.limit) params.limit = String(options.limit);
      if (options.page) params.page = String(options.page);
      if (options.categories && options.categories.length > 0) {
        params.categoryIds = options.categories.join(',');
      }
      if (options.minPrice != null) params.minPrice = String(options.minPrice);
      if (options.maxPrice != null) params.maxPrice = String(options.maxPrice);
      if (options.inStock != null) params.inStock = String(options.inStock);

      const data = await this.apiClient.get<any>('/customer/products/search', params);
      const result = data.data || data;
      const products = result.products || result.results || result || [];

      return products.map((p: any) => ({
        id: String(p.productId || p.id || ''),
        name: p.name || p.title || '',
        description: p.description || '',
        price: parseFloat(p.price || p.variants?.[0]?.price) || 0,
        imageUrl: p.images?.[0]?.url || p.thumbnail || '',
        category: p.productType || p.category || '',
        sku: p.sku || p.variants?.[0]?.sku || '',
        barcode: p.barcode || p.variants?.[0]?.barcode || '',
        inStock: p.inStock != null ? Boolean(p.inStock) : (p.variants?.[0]?.inventoryQuantity ?? 0) > 0,
        source: 'ecommerce' as const,
        originalProduct: p,
      }));
    } catch (error) {
      this.logger.error({ message: 'Error searching products on CommerceFull' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull search service not initialized');
    }

    try {
      const params: Record<string, string> = {};
      if (options.limit) params.limit = String(options.limit);
      if (options.page) params.page = String(options.page);
      if (options.search) params.search = options.search;
      if (options.category) params.category = options.category;

      const data = await this.apiClient.get<any>('/customer/products', params);
      const products = (data.data || data.products || data || []).map((p: any) => ({
        id: String(p.productId || p.id || ''),
        title: p.name || p.title || '',
        description: p.description || '',
        vendor: p.vendor || p.brand || '',
        productType: p.productType || '',
        tags: p.tags || [],
        options: p.options || [],
        variants: (p.variants || []).map((v: any) => ({
          id: String(v.variantId || v.id || ''),
          title: v.name || v.title || 'Default',
          sku: v.sku || '',
          barcode: v.barcode || '',
          price: parseFloat(v.price) || 0,
          compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : undefined,
          inventoryQuantity: v.inventoryQuantity ?? v.stockQuantity ?? 0,
        })),
        images: (p.images || []).map((img: any) => ({
          id: String(img.imageId || img.id || ''),
          url: img.url || img.src || '',
          alt: img.alt || '',
        })),
      }));

      const pagination = data.pagination || data.meta || {};
      return {
        products,
        pagination: {
          currentPage: pagination.currentPage || options.page || 1,
          totalPages: pagination.totalPages || 1,
          totalItems: pagination.totalItems || products.length,
          perPage: pagination.perPage || options.limit,
        },
      };
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching products from CommerceFull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } };
    }
  }

  /**
   * Dedicated barcode lookup via GET /customer/products/barcode/:barcode.
   * Returns at most 1 product for an exact barcode match.
   */
  async searchByBarcode(barcode: string): Promise<SearchProduct[]> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull search service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/customer/products/barcode/${encodeURIComponent(barcode)}`);
      const product = data.data || data;
      if (!product || !product.id) return [];

      return [
        {
          id: String(product.productId || product.id || ''),
          name: product.name || product.title || '',
          description: product.description || '',
          price: parseFloat(product.price || product.variants?.[0]?.price) || 0,
          imageUrl: product.images?.[0]?.url || product.thumbnail || '',
          category: product.productType || product.category || '',
          sku: product.sku || product.variants?.[0]?.sku || '',
          barcode,
          inStock: product.inStock != null ? Boolean(product.inStock) : (product.variants?.[0]?.inventoryQuantity ?? 0) > 0,
          source: 'ecommerce' as const,
          originalProduct: product,
        },
      ];
    } catch (error) {
      this.logger.error({ message: `Barcode lookup failed for ${barcode}` }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('CommerceFull search service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>('/customer/categories');
      const categories = data.data || data.categories || data || [];

      return categories
        .map((c: any) => c.name || c.slug || '')
        .filter(Boolean)
        .sort();
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching categories from CommerceFull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }
}
