import { SearchServiceInterface, SearchOptions, SearchResult, SearchProduct } from '../SearchServiceInterface';
import { instoreApiClient } from '../../../../features/platform-clients/services/clients/instoreapi/InstoreApiClient';
import { Product } from '../../../../features/catalogue/repositories/ProductRepository';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Store API-backed search for multi-register offline catalogue.
 * Barcode and text lookups hit the server's indexed columns/data_json
 * instead of a per-device KV copy.
 */
export class InstoreApiSearchService implements SearchServiceInterface {
  private initialized = false;
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiSearchService');

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async searchProducts(query: string, options?: SearchOptions): Promise<SearchResult> {
    const trimmed = query.trim();
    const rows = trimmed ? await instoreApiClient.getProducts({ search: trimmed }) : await instoreApiClient.getProducts();
    let items = rows.map(row => this.toSearchProduct(row));

    if (options?.inStock) {
      items = items.filter(p => p.inStock);
    }
    if (options?.minPrice !== undefined) {
      items = items.filter(p => p.price >= options.minPrice!);
    }
    if (options?.maxPrice !== undefined) {
      items = items.filter(p => p.price <= options.maxPrice!);
    }
    if (options?.categories && options.categories.length > 0) {
      items = items.filter(p => p.category && options.categories!.includes(p.category));
    }
    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return {
      query,
      totalResults: items.length,
      localResults: items,
      ecommerceResults: [],
      categories: [...new Set(items.map(p => p.category).filter((c): c is string => !!c))],
    };
  }

  async searchByBarcode(barcode: string): Promise<SearchResult> {
    const rows = await instoreApiClient.getProducts({ barcode });
    const items = rows.map(row => this.toSearchProduct(row));
    return { query: barcode, totalResults: items.length, localResults: items, ecommerceResults: [], categories: [] };
  }

  getSearchHistory(): string[] {
    // Search history is a per-device convenience — nothing shared to return.
    return [];
  }

  clearSearchHistory(): void {
    // Search history is a per-device convenience — no shared state to clear.
  }

  private toSearchProduct(row: Product): SearchProduct {
    let imageUrl: string | undefined;
    if (row.data_json) {
      try {
        const doc = JSON.parse(row.data_json) as { images?: Array<{ url: string }> };
        imageUrl = doc.images?.[0]?.url;
      } catch (error) {
        this.logger.error(
          { message: 'Failed to parse product data_json in search' },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      price: row.price,
      imageUrl,
      category: row.category_id ?? undefined,
      source: 'local',
      inStock: row.stock > 0,
      quantity: row.stock,
      sku: row.sku ?? undefined,
      barcode: row.barcode ?? undefined,
      originalProduct: row,
    };
  }
}

export const instoreApiSearchService = new InstoreApiSearchService();
