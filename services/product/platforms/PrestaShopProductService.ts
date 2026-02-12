import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import { createBasicAuthHeader } from '../../../utils/base64';

// PrestaShop API version - typically doesn't change
const PRESTASHOP_API_VERSION = '1';

/**
 * PrestaShop-specific implementation of the product service
 * Supports PrestaShop Web Services API
 */
export class PrestaShopProductService extends BaseProductService {
  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('PrestaShopProductService');
  }

  async initialize(): Promise<boolean> {
    try {
      this.config.storeUrl = this.config.storeUrl || process.env.PRESTASHOP_STORE_URL || '';
      this.config.apiKey = this.config.apiKey || process.env.PRESTASHOP_API_KEY || '';

      if (this.config.storeUrl) {
        this.config.storeUrl = this.normalizeUrl(this.config.storeUrl as string);
      }

      if (!this.config.storeUrl || !this.config.apiKey) {
        this.logger.warn('Missing PrestaShop API configuration');
        return false;
      }

      await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.PRESTASHOP);

      // Test connection
      try {
        const apiUrl = `${this.config.storeUrl}/api/products?output_format=JSON&limit=1`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          this.logger.error({ message: 'Failed to connect to PrestaShop API' }, new Error(`Status: ${response.status}`));
          return false;
        }
      } catch (error) {
        this.logger.error({ message: 'Error connecting to PrestaShop API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize PrestaShop product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey'],
      optional: [],
      description: 'PrestaShop requires store URL and API key for authentication',
    };
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
      try {
        const params = new URLSearchParams();
        params.append('output_format', 'JSON');
        params.append('display', 'full');

        // Pagination
        const limit = options.limit || 20;
        const offset = ((options.page || 1) - 1) * limit;
        params.append('limit', `${offset},${limit}`);

        // Search filter
        if (options.search) {
          params.append('filter[name]', `[${options.search}]%`);
        }

        // IDs filter
        if (options.ids && options.ids.length > 0) {
          params.append('filter[id]', `[${options.ids.join('|')}]`);
        }

        const apiUrl = `${this.config.storeUrl}/api/products?${params.toString()}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from PrestaShop: ${response.statusText}`);
        }

        const data = await response.json();
        const psProducts = data.products || [];
        const products = psProducts.map((p: any) => this.mapToProduct(p));

        // Get total count for pagination
        const countUrl = `${this.config.storeUrl}/api/products?output_format=JSON`;
        const countResponse = await fetch(countUrl, { headers });
        let totalItems = products.length;
        if (countResponse.ok) {
          const countData = await countResponse.json();
          totalItems = countData.products?.length || products.length;
        }

        return {
          products,
          pagination: {
            currentPage: options.page || 1,
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            perPage: limit,
          },
        };
      } catch (error) {
        this.logger.error(
          { message: 'Error fetching products from PrestaShop' },
          error instanceof Error ? error : new Error(String(error))
        );
        return {
          products: [],
          pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit || 20 },
        };
      }
    });
  }

  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
      try {
        const apiUrl = `${this.config.storeUrl}/api/products/${productId}?output_format=JSON&display=full`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from PrestaShop: ${response.statusText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data.product);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product ${productId} from PrestaShop` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
      try {
        const apiUrl = `${this.config.storeUrl}/api/products?output_format=JSON`;
        const psProduct = this.mapToPrestaShopProduct(product);
        const headers = await this.getAuthHeaders();

        // PrestaShop uses XML by default, but we can use JSON
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product: psProduct }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create product on PrestaShop: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data.product);
      } catch (error) {
        this.logger.error({ message: 'Error creating product on PrestaShop' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
      try {
        const existingProduct = await this.getProductById(productId);
        if (!existingProduct) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        const updatedProduct = { ...existingProduct, ...productData };
        const psProduct = this.mapToPrestaShopProduct(updatedProduct);

        const apiUrl = `${this.config.storeUrl}/api/products/${productId}?output_format=JSON`;
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product: psProduct }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update product on PrestaShop: ${response.statusText}`);
        }

        const data = await response.json();
        return this.mapToProduct(data.product);
      } catch (error) {
        this.logger.error(
          { message: `Error updating product ${productId} on PrestaShop` },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    });
  }

  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.PRESTASHOP, async () => {
      try {
        const apiUrl = `${this.config.storeUrl}/api/products/${productId}`;
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
        });

        return response.ok;
      } catch (error) {
        this.logger.error(
          { message: `Error deleting product ${productId} from PrestaShop` },
          error instanceof Error ? error : new Error(String(error))
        );
        return false;
      }
    });
  }

  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('PrestaShop product service not initialized');
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

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    // PrestaShop uses Basic Auth with API key as username and empty password
    return {
      Authorization: createBasicAuthHeader(this.config.apiKey as string, ''),
      Accept: 'application/json',
    };
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  protected mapToProduct(psProduct: any): Product {
    // Extract name from language array
    const getName = (nameData: any) => {
      if (typeof nameData === 'string') return nameData;
      if (Array.isArray(nameData)) return nameData[0]?.value || '';
      if (nameData?.language) {
        const langs = Array.isArray(nameData.language) ? nameData.language : [nameData.language];
        return langs[0]?.value || langs[0] || '';
      }
      return '';
    };

    const getDescription = (descData: any) => {
      if (typeof descData === 'string') return descData;
      if (Array.isArray(descData)) return descData[0]?.value || '';
      if (descData?.language) {
        const langs = Array.isArray(descData.language) ? descData.language : [descData.language];
        return langs[0]?.value || langs[0] || '';
      }
      return '';
    };

    // Build variants from combinations or simple product
    const variants = [
      {
        id: String(psProduct.id),
        title: 'Default',
        sku: psProduct.reference || '',
        barcode: psProduct.ean13 || psProduct.upc,
        price: parseFloat(psProduct.price || '0'),
        inventoryQuantity: parseInt(psProduct.quantity || '0', 10),
        weight: parseFloat(psProduct.weight || '0'),
        weightUnit: 'kg' as const,
      },
    ];

    // Extract images
    const images = (psProduct.associations?.images || []).map((img: any, index: number) => ({
      id: String(img.id),
      url: `${this.config.storeUrl}/api/images/products/${psProduct.id}/${img.id}`,
      alt: '',
      position: index,
    }));

    return {
      id: String(psProduct.id),
      title: getName(psProduct.name),
      description: getDescription(psProduct.description) || getDescription(psProduct.description_short),
      vendor: psProduct.manufacturer_name || '',
      productType: '',
      tags: (psProduct.associations?.tags || []).map((t: any) => t.name || ''),
      options: [],
      variants,
      images,
      createdAt: psProduct.date_add ? new Date(psProduct.date_add) : undefined,
      updatedAt: psProduct.date_upd ? new Date(psProduct.date_upd) : undefined,
    };
  }

  private mapToPrestaShopProduct(product: Product): any {
    const primaryVariant = product.variants[0] || { sku: '', price: 0, inventoryQuantity: 0, weight: 0 };

    return {
      name: [{ id: 1, value: product.title }], // Language 1 = default
      description: [{ id: 1, value: product.description || '' }],
      description_short: [{ id: 1, value: (product.description || '').substring(0, 400) }],
      reference: primaryVariant.sku,
      price: primaryVariant.price,
      quantity: primaryVariant.inventoryQuantity || 0,
      weight: primaryVariant.weight || 0,
      active: 1,
      available_for_order: 1,
      show_price: 1,
    };
  }
}
