/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { SearchOptions, SearchProduct } from '../SearchServiceInterface';
import { Product, ProductResult, ProductQueryOptions } from '../../product/ProductServiceInterface';
import { PlatformSearchServiceInterface, PlatformConfigRequirements, PlatformSearchConfig } from './PlatformSearchServiceInterface';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { toCents, toDollars } from '../../../utils/money';

/**
 * Commercefull platform implementation of the search service.
 *
 * Endpoint mapping:
 *   GET  /customer/products/search   → searchPlatformProducts
 *        params: q, categoryId(s), minPriceCents, maxPriceCents, inStock, sortBy, page, limit
 *        response: { data: { products, total, page, limit, totalPages } }
 *   GET  /customer/products          → getProducts
 *        params: categoryId, priceMin, priceMax, limit, offset
 *        response: { data: { products, total, limit, offset, hasMore } }
 *   GET  /customer/products/barcode/:barcode → searchByBarcode
 *        response: { data: { product, variant } } (domain entities, no price)
 *   GET  /customer/products/:id      → barcode follow-up fetch for prices
 *   GET  /customer/categories        → getCategories
 *
 * All monetary fields on the platform are integer cents (*Cents).
 */
export class CommercefullSearchService implements PlatformSearchServiceInterface {
  private initialized = false;
  private config: PlatformSearchConfig = {};
  private apiClient: CommercefullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommercefullSearchService');

  constructor(config: PlatformSearchConfig = {}) {
    this.config = config;
    this.apiClient = CommercefullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommercefullConfig = {
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
        { message: 'Failed to initialize Commercefull search service' },
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
      description: 'Commercefull search service requires store URL and API credentials',
    };
  }

  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull search service not initialized');
    }

    try {
      const params: Record<string, string> = { q: query };
      if (options.limit) params.limit = String(options.limit);
      if (options.page) params.page = String(options.page);
      if (options.categories && options.categories.length > 0) {
        params.categoryIds = options.categories.join(',');
      }
      // Price filters are integer cents on the platform.
      if (options.minPrice != null) params.minPriceCents = String(toCents(options.minPrice));
      if (options.maxPrice != null) params.maxPriceCents = String(toCents(options.maxPrice));
      if (options.inStock != null) params.inStock = String(options.inStock);

      const data = await this.apiClient.get<any>('/customer/products/search', params);
      const result = data?.data || data;
      const products = Array.isArray(result) ? result : result.products || result.results || [];

      return products.map((p: any) => this.mapSearchRow(p));
    } catch (error) {
      this.logger.error({ message: 'Error searching products on Commercefull' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull search service not initialized');
    }

    try {
      // The customer product list has no text-search filter; route text
      // queries through the search endpoint (page-based) instead.
      if (options.search) {
        return this.searchAsProductResult(options);
      }

      const limit = options.limit || 20;
      const page = options.page || 1;
      const params: Record<string, string> = { limit: String(limit), offset: String((page - 1) * limit) };
      if (options.category) params.categoryId = options.category;

      const data = await this.apiClient.get<any>('/customer/products', params);
      const payload = data?.data || {};
      const rows = Array.isArray(payload) ? payload : payload.products || [];
      const products = rows.map((p: any) => this.mapListItemToProduct(p));

      const total = payload.total ?? products.length;
      const offset = payload.offset ?? 0;
      return {
        products,
        pagination: {
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
          totalItems: total,
          perPage: payload.limit || limit,
        },
      };
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching products from Commercefull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } };
    }
  }

  private async searchAsProductResult(options: ProductQueryOptions): Promise<ProductResult> {
    const limit = options.limit || 20;
    const page = options.page || 1;
    const params: Record<string, string> = { q: options.search as string, limit: String(limit), page: String(page) };
    if (options.category) params.categoryId = options.category;

    const data = await this.apiClient.get<any>('/customer/products/search', params);
    const result = data?.data || {};
    const rows = Array.isArray(result) ? result : result.products || [];

    return {
      products: rows.map((p: any) => this.mapListItemToProduct(p)),
      pagination: {
        currentPage: result.page || page,
        totalPages: result.totalPages || 1,
        totalItems: result.total ?? rows.length,
        perPage: result.limit || limit,
      },
    };
  }

  /**
   * Dedicated barcode lookup via GET /customer/products/barcode/:barcode.
   * The endpoint returns { product, variant } domain entities without prices,
   * so the product detail is fetched afterwards for pricing.
   * Returns at most 1 product for an exact barcode match.
   */
  async searchByBarcode(barcode: string): Promise<SearchProduct[]> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull search service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/customer/products/barcode/${encodeURIComponent(barcode)}`);
      const payload = data?.data || data;
      const product = payload?.product || payload;
      const variant = payload?.variant;
      if (!product || !(product.productId || product.id)) return [];

      // Barcode rows carry no price — fetch the product detail for pricing.
      let detail: any = product;
      try {
        const detailData = await this.apiClient.get<any>(`/customer/products/${product.productId || product.id}`);
        detail = detailData?.data || detailData || product;
      } catch {
        this.logger.warn({ message: `Could not fetch price detail for barcode product ${product.productId}` });
      }

      const detailVariant =
        detail.variants?.find((v: any) => String(v.variantId || v.id) === String(variant?.variantId || variant?.id)) ||
        variant ||
        detail.variants?.[0];

      return [
        {
          id: String(product.productId || product.id || ''),
          name: product.name || product.title || '',
          description: detail.description || product.description || product.shortDescription || '',
          price:
            toDollars(
              detailVariant?.effectivePriceCents ?? detailVariant?.basePriceCents ?? detail.effectivePriceCents ?? detail.basePriceCents
            ) || 0,
          imageUrl: detailVariant?.imageUrl || detail.primaryImageUrl || detail.images?.[0]?.url || product.primaryImage?.url || '',
          category: product.categoryId || product.productType || '',
          sku: detailVariant?.sku || product.sku || '',
          barcode: detailVariant?.barcode || barcode,
          inStock: detailVariant?.isInStock != null ? Boolean(detailVariant.isInStock) : (detailVariant?.stockQuantity ?? 0) > 0,
          quantity: detailVariant?.stockQuantity,
          source: 'ecommerce' as const,
          originalProduct: { product, variant: detailVariant },
        },
      ];
    } catch (error) {
      this.logger.error({ message: `Barcode lookup failed for ${barcode}` }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async getCategories(): Promise<string[]> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull search service not initialized');
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
        { message: 'Error fetching categories from Commercefull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /** Map a search row (DbProduct + priceCents fields) to SearchProduct. */
  private mapSearchRow(p: any): SearchProduct {
    return {
      id: String(p.productId || p.id || ''),
      name: p.name || p.title || '',
      description: p.shortDescription || p.description || '',
      price: toDollars(p.effectivePriceCents ?? p.priceCents ?? p.basePriceCents) || 0,
      imageUrl: p.primaryImageUrl || p.primaryImage?.url || p.images?.[0]?.url || p.imageUrl || '',
      category: p.categoryName || p.categoryId || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      inStock: p.inStock != null ? Boolean(p.inStock) : (p.stockQuantity ?? 0) > 0,
      quantity: p.stockQuantity,
      source: 'ecommerce' as const,
      originalProduct: p,
    };
  }

  /** Map a list/search row (cents prices, no variants) to a Product. */
  private mapListItemToProduct(p: any): Product {
    const price = toDollars(p.effectivePriceCents ?? p.priceCents ?? p.basePriceCents) || 0;
    return {
      id: String(p.productId || p.id || ''),
      title: p.name || p.title || '',
      description: p.description || p.shortDescription || '',
      vendor: p.brandName || p.vendor || '',
      productType: p.productTypeId || p.productType || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
      variants: [
        {
          id: String(p.variants?.[0]?.variantId || p.productId || p.id || ''),
          title: p.variants?.[0]?.name || 'Default',
          sku: p.sku || p.variants?.[0]?.sku || '',
          barcode: p.barcode || p.variants?.[0]?.barcode || '',
          price,
          inventoryQuantity: p.stockQuantity ?? 0,
        },
      ],
      images:
        p.images?.map((img: any) => ({
          id: String(img.imageId || img.id || ''),
          url: img.url || '',
          alt: img.altText || img.alt || '',
        })) || (p.primaryImageUrl || p.primaryImage?.url ? [{ id: '', url: p.primaryImageUrl || p.primaryImage.url, alt: '' }] : []),
      createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    };
  }
}
