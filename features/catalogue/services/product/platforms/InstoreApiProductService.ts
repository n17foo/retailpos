import { instoreApiClient } from '../../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { serverDataCache } from '../../../../multi-register/services/offline/ServerDataCache';
import { isStoreApiUnavailable } from '../../../../multi-register/services/offline/isStoreApiUnavailable';
import { Product as ServerProduct } from '../../../repositories/ProductRepository';
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductServiceInterface, PlatformConfigRequirements, PlatformProductConfig } from './PlatformProductServiceInterface';
import { LoggerFactory } from '../../../../../shared/services/logger/LoggerFactory';

/**
 * Store API-backed product service for multi-register deployments.
 *
 * In client mode the Store API is the authoritative catalogue store: every
 * register reads and writes the same products instead of a per-device KV blob.
 * The full POS product document (variants, images, options) round-trips in the
 * server's opaque `data_json` column; the flat columns stay the indexed
 * projection for barcode/search/report queries.
 */
export class InstoreApiProductService implements PlatformProductServiceInterface {
  private initialized = false;
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiProductService');

  constructor(_config: PlatformProductConfig = {}) {}

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: [],
      optional: [],
      description: 'Store API catalogue — products shared across all registers via the in-store server.',
    };
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    let rows: ServerProduct[];
    try {
      rows = await instoreApiClient.getProducts(options.search ? { search: options.search } : undefined);
      // Warm the offline cache with every successful fetch — the register can
      // keep selling its last-known catalogue during a LAN outage.
      await serverDataCache.mergeProducts(rows);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      const cached = await serverDataCache.getProducts<ServerProduct>();
      if (!cached) throw error;
      rows = cached;
    }
    let products = rows.map(row => this.toPosProduct(row));

    if (options.search) {
      // Cached reads repeat the server-side filter client-side (offline rows
      // skip the server's search narrowing).
      const q = options.search.toLowerCase();
      products = products.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.variants.some(v => v.sku?.toLowerCase().includes(q) || v.barcode?.toLowerCase().includes(q))
      );
    }
    if (options.category) {
      products = products.filter(p => p.productType === options.category || p.tags?.includes(options.category || ''));
    }
    if (options.ids && options.ids.length > 0) {
      products = products.filter(p => options.ids!.includes(p.id));
    }
    if (!options.includeOutOfStock) {
      products = products.filter(p => p.variants.some(v => v.inventoryQuantity > 0));
    }

    const page = options.page || 1;
    const limit = options.limit || 50;
    const startIndex = (page - 1) * limit;
    return {
      products: products.slice(startIndex, startIndex + limit),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(products.length / limit),
        totalItems: products.length,
        perPage: limit,
      },
    };
  }

  async getProductById(productId: string): Promise<Product | null> {
    try {
      const row = await instoreApiClient.getProduct(productId);
      if (row) {
        await serverDataCache.mergeProducts([row]);
        return this.toPosProduct(row);
      }
      return null;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      const cached = await serverDataCache.getProducts<ServerProduct>();
      const row = cached?.find(p => p.id === productId);
      return row ? this.toPosProduct(row) : null;
    }
  }

  async createProduct(product: Product): Promise<Product> {
    const row = await instoreApiClient.createProduct(this.toServerProduct(product));
    return this.toPosProduct(row);
  }

  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    // Merge onto the stored document so data_json never degrades to a patch.
    const existing = await this.getProductById(productId);
    const merged: Product = existing
      ? { ...existing, ...productData, id: productId, updatedAt: new Date() }
      : ({ ...productData, id: productId, title: productData.title ?? '', variants: productData.variants ?? [] } as Product);
    const row = await instoreApiClient.updateProduct(productId, this.toServerPatch(merged));
    return this.toPosProduct(row);
  }

  async deleteProduct(productId: string): Promise<boolean> {
    try {
      await instoreApiClient.deleteProduct(productId);
      await serverDataCache.removeProduct(productId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Replaces the shared catalogue — used when seeding products from another
   * source. Existing products are updated, missing ones created.
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    const errors: Array<{ productId: string; error: string }> = [];
    let successful = 0;
    for (const product of products) {
      try {
        const existing = product.id ? await instoreApiClient.getProduct(product.id) : null;
        if (existing) {
          await instoreApiClient.updateProduct(product.id, this.toServerPatch(product));
        } else {
          await instoreApiClient.createProduct(this.toServerProduct(product));
        }
        successful++;
      } catch (error) {
        errors.push({ productId: product.id, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return { successful, failed: errors.length, errors };
  }

  /** Clear the shared catalogue (explicit admin action — affects all registers). */
  async clearLocalProducts(): Promise<void> {
    const rows = await instoreApiClient.getProducts();
    for (const row of rows) {
      await instoreApiClient.deleteProduct(row.id);
    }
  }

  /** Map a server product row back to the rich POS Product. */
  private toPosProduct(row: ServerProduct): Product {
    if (row.data_json) {
      try {
        const doc = JSON.parse(row.data_json) as Product;
        // Flat columns are the authoritative indexed projection — keep them in sync.
        return {
          ...doc,
          id: row.id,
          title: row.name,
          description: row.description ?? doc.description,
          updatedAt: new Date(row.updated_at),
        };
      } catch (error) {
        this.logger.error({ message: 'Failed to parse product data_json' }, error instanceof Error ? error : new Error(String(error)));
      }
    }
    const stock = row.stock;
    return {
      id: row.id,
      title: row.name,
      description: row.description ?? '',
      variants: [
        {
          id: `${row.id}-default`,
          title: 'Default',
          sku: row.sku ?? '',
          barcode: row.barcode ?? '',
          price: row.price,
          inventoryQuantity: stock,
          trackInventory: true,
          isAvailable: stock > 0,
        },
      ],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /** Extract the indexed flat fields; the full document goes in data_json. */
  private toServerProduct(product: Product): Omit<ServerProduct, 'id' | 'created_at' | 'updated_at'> {
    const primary = product.variants[0];
    return {
      name: product.title,
      description: product.description ?? null,
      price: primary?.price ?? 0,
      sku: primary?.sku ?? null,
      barcode: primary?.barcode ?? null,
      category_id: product.categoryIds?.[0] ?? null,
      stock: primary?.inventoryQuantity ?? 0,
      data_json: JSON.stringify(product),
    };
  }

  private toServerPatch(data: Partial<Product>): Partial<ServerProduct> {
    const patch: Partial<ServerProduct> = {};
    if (data.title !== undefined) patch.name = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.variants) {
      patch.price = data.variants[0]?.price;
      patch.sku = data.variants[0]?.sku ?? null;
      patch.barcode = data.variants[0]?.barcode ?? null;
      patch.stock = data.variants[0]?.inventoryQuantity;
    }
    if (data.categoryIds) patch.category_id = data.categoryIds[0] ?? null;
    // data_json carries whatever document the caller merged — patch from it
    patch.data_json = JSON.stringify(data);
    return patch;
  }
}

export const instoreApiProductService = new InstoreApiProductService();
