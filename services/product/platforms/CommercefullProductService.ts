/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { toCents, toDollars } from '../../../utils/money';

/**
 * Commercefull platform implementation of the product service.
 * Uses the Commercefull REST API via the shared API client.
 *
 * Endpoint mapping:
 *   GET    /business/products                → getProducts (offset pagination, {data: {products, total, ...}})
 *   GET    /business/products/:id            → getProductById (ProductDetailResponse)
 *   POST   /business/products                → createProduct (requires productTypeId)
 *   POST   /business/products/:id/variants   → variant creation after product create
 *   POST   /business/products/:id/images     → image upload after product create
 *   PUT    /business/products/:id            → updateProduct
 *   DELETE /business/products/:id            → deleteProduct
 *   GET    /business/product-types           → productTypeId resolution
 *
 * All monetary fields on the platform are integer cents (*Cents).
 */
export class CommercefullProductService extends BaseProductService {
  private apiClient: CommercefullApiClient;

  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('CommercefullProductService');
    this.apiClient = CommercefullApiClient.getInstance();
  }

  async initialize(): Promise<boolean> {
    try {
      const clientConfig: CommercefullConfig = {
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
        { message: 'Failed to initialize Commercefull product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion'],
      description: 'Commercefull product service requires store URL and API credentials',
    };
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull product service not initialized');
    }

    try {
      // The platform paginates with limit/offset, not page.
      const limit = options.limit || 50;
      const page = options.page || 1;

      const params: Record<string, string> = { limit: String(limit), offset: String((page - 1) * limit) };
      if (options.search) params.search = options.search;
      if (options.category) params.categoryId = options.category;

      // The list endpoint has no ids filter — fetch each product directly.
      if (options.ids && options.ids.length > 0) {
        const fetched = await Promise.all(options.ids.map(id => this.getProductById(id)));
        const products = fetched.filter((p): p is Product => p !== null);
        return {
          products,
          pagination: { currentPage: 1, totalPages: 1, totalItems: products.length, perPage: products.length || limit },
        };
      }

      const data = await this.apiClient.get<any>('/business/products', params);
      const payload = data?.data || {};
      const products: Product[] = (Array.isArray(payload) ? payload : payload.products || []).map((p: any) => this.mapToProduct(p));

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
      return { products: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit } };
    }
  }

  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull product service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/business/products/${productId}`);
      const product = data?.data || data?.product || data;
      return this.mapToProduct(product);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching product ${productId} from Commercefull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull product service not initialized');
    }

    try {
      const productTypeId = await this.resolveProductTypeId(product.productType);
      const body = this.mapToCommercefullProduct(product, productTypeId);
      const data = await this.apiClient.post<any>('/business/products', body);
      const created = data?.data || data?.product || data;
      const productId = String(created?.productId || created?.id || '');

      // Variants and images are separate resources on the platform.
      if (productId) {
        await this.syncVariants(productId, product);
        await this.syncImages(productId, product);
      }

      const fetched = productId ? await this.getProductById(productId) : null;
      return fetched || this.mapToProduct(created);
    } catch (error) {
      this.logger.error({ message: 'Error creating product on Commercefull' }, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull product service not initialized');
    }

    try {
      const body = this.mapToCommercefullProduct(productData);
      const data = await this.apiClient.put<any>(`/business/products/${productId}`, body);
      return this.mapToProduct(data?.data || data?.product || data);
    } catch (error) {
      this.logger.error(
        { message: `Error updating product ${productId} on Commercefull` },
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull product service not initialized');
    }

    try {
      await this.apiClient.delete(`/business/products/${productId}`);
      return true;
    } catch (error) {
      this.logger.error(
        { message: `Error deleting product ${productId} from Commercefull` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull product service not initialized');
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

  /**
   * Resolve a POS productType (name, slug, or id) to a platform productTypeId.
   */
  private async resolveProductTypeId(productType?: string): Promise<string | undefined> {
    if (!productType) return undefined;

    try {
      const data = await this.apiClient.get<any>('/business/product-types');
      const types: any[] = Array.isArray(data?.data) ? data.data : data?.data?.data || [];
      const needle = productType.toLowerCase();
      const match = types.find(
        t =>
          String(t.productTypeId || t.id) === productType ||
          String(t.slug || '').toLowerCase() === needle ||
          String(t.name || '').toLowerCase() === needle
      );
      if (match) {
        return String(match.productTypeId || match.id);
      }
      this.logger.warn({ message: `Commercefull product type '${productType}' not found; product create may fail` });
      return undefined;
    } catch (error) {
      this.logger.warn(
        { message: 'Could not resolve Commercefull product types' },
        error instanceof Error ? error : new Error(String(error))
      );
      return undefined;
    }
  }

  private async syncVariants(productId: string, product: Product): Promise<void> {
    for (const variant of product.variants || []) {
      try {
        await this.apiClient.post<any>(`/business/products/${productId}/variants`, {
          name: variant.title || 'Default',
          sku: variant.sku,
          barcode: variant.barcode,
          priceCents: toCents(variant.price),
          compareAtPriceCents: variant.compareAtPrice != null ? toCents(variant.compareAtPrice) : undefined,
          weight: variant.weight,
          weightUnit: variant.weightUnit,
        });
      } catch (error) {
        this.logger.warn(
          { message: `Failed to create variant ${variant.sku || variant.id} on Commercefull product ${productId}` },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  private async syncImages(productId: string, product: Product): Promise<void> {
    for (const [index, image] of (product.images || []).entries()) {
      try {
        await this.apiClient.post<any>(`/business/products/${productId}/images`, {
          url: image.url,
          alt: image.alt,
          position: image.position ?? index,
          isPrimary: index === 0,
        });
      } catch (error) {
        this.logger.warn(
          { message: `Failed to add image to Commercefull product ${productId}` },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  protected mapToProduct(p: any): Product {
    if (!p) return { id: '', title: '', variants: [] };

    const variants =
      p.variants?.map((v: any) => ({
        id: String(v.variantId || v.id || ''),
        title: v.name || v.title || v.attributeString || 'Default',
        sku: v.sku || '',
        barcode: v.barcode || '',
        price: toDollars(v.effectivePriceCents ?? v.basePriceCents ?? v.priceCents) || 0,
        compareAtPrice: v.compareAtPriceCents != null ? toDollars(v.compareAtPriceCents) : undefined,
        inventoryQuantity: v.stockQuantity ?? v.inventoryQuantity ?? 0,
        weight: v.weight ?? undefined,
        weightUnit: v.weightUnit,
        options: Array.isArray(v.attributes) ? v.attributes.map((a: any) => a.displayValue || a.value || '') : [],
        imageId: v.imageId,
      })) || [];

    // Products without explicit variants still need a sellable default variant.
    if (variants.length === 0 && (p.productId || p.id)) {
      variants.push({
        id: String(p.productId || p.id),
        title: 'Default',
        sku: p.sku || '',
        barcode: p.barcode || '',
        price: toDollars(p.effectivePriceCents ?? p.basePriceCents ?? p.priceCents) || 0,
        compareAtPrice: undefined,
        inventoryQuantity: p.stockQuantity ?? 0,
        options: [],
      });
    }

    const images =
      p.images?.map((img: any) => ({
        id: String(img.imageId || img.id || ''),
        url: img.url || img.src || '',
        alt: img.altText || img.alt || '',
        position: img.position ?? img.sortOrder,
      })) || [];

    if (images.length === 0 && p.primaryImageUrl) {
      images.push({ id: '', url: p.primaryImageUrl, alt: '', position: 0 });
    }

    return {
      id: String(p.productId || p.id || ''),
      title: p.name || p.title || '',
      description: p.description || p.shortDescription || '',
      vendor: p.brandName || p.vendor || p.brand || '',
      productType: p.productTypeId || p.productType || p.type || '',
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

  private mapToCommercefullProduct(product: Product | Partial<Product>, productTypeId?: string): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (product.title) body.name = product.title;
    if (product.description !== undefined) body.description = product.description;
    if (productTypeId) body.productTypeId = productTypeId;
    if (product.tags) body.tags = product.tags;

    // Price lives on the first/default variant in the POS model.
    const primaryVariant = product.variants?.[0];
    if (primaryVariant) {
      body.sku = primaryVariant.sku;
      if (primaryVariant.price != null) body.basePriceCents = toCents(primaryVariant.price);
      if (primaryVariant.compareAtPrice != null) body.compareAtPriceCents = toCents(primaryVariant.compareAtPrice);
      if (primaryVariant.weight != null) body.weight = primaryVariant.weight;
      if (primaryVariant.weightUnit) body.weightUnit = primaryVariant.weightUnit;
    }
    return body;
  }
}
