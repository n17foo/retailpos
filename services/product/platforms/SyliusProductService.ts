import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { TokenInitializer } from '../../token/tokenInitializer';
import { withTokenRefresh } from '../../token/tokenIntegration';
import { LoggerFactory } from '../../logger/loggerFactory';
import { SYLIUS_API_VERSION } from '../../config/apiVersions';

/**
 * Sylius-specific implementation of the product service
 * Supports Sylius REST API
 */
export class SyliusProductService extends BaseProductService {
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

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
      this.config.apiVersion = this.config.apiVersion || process.env.SYLIUS_API_VERSION || SYLIUS_API_VERSION;

      // Normalize API URL
      if (this.config.apiUrl) {
        this.config.apiUrl = this.normalizeUrl(this.config.apiUrl as string);
      }

      if (!this.config.apiUrl) {
        this.logger.warn('Missing Sylius API URL configuration');
        return false;
      }

      // Initialize token provider
      await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.SYLIUS);

      // Get OAuth token if needed
      if (!this.config.accessToken && this.config.apiKey && this.config.apiSecret) {
        const token = await this.getOAuthToken();
        if (!token) {
          this.logger.error({ message: 'Failed to authenticate with Sylius' });
          return false;
        }
      }

      // Test connection
      try {
        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products?limit=1`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          this.logger.error({ message: 'Failed to connect to Sylius API' }, new Error(`Status: ${response.status}`));
          return false;
        }
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

        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products?${params.toString()}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from Sylius: ${response.statusText}`);
        }

        const data = await response.json();

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
        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products/${productId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from Sylius: ${response.statusText}`);
        }

        const syliusProduct = await response.json();
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
        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products`;
        const syliusProduct = this.mapToSyliusProduct(product);
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(syliusProduct),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create product on Sylius: ${response.statusText} - ${errorText}`);
        }

        const createdProduct = await response.json();
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

        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products/${productId}`;
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(syliusProduct),
        });

        if (!response.ok) {
          throw new Error(`Failed to update product on Sylius: ${response.statusText}`);
        }

        const updated = await response.json();
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
        const apiUrl = `${this.config.apiUrl}/api/${this.config.apiVersion}/products/${productId}`;
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
        });

        return response.ok || response.status === 204;
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
   * Get OAuth token
   */
  private async getOAuthToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
      return this.accessToken;
    }

    try {
      const apiUrl = `${this.config.apiUrl}/api/oauth/v2/token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.apiKey as string,
          client_secret: this.config.apiSecret as string,
        }).toString(),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiration = new Date(Date.now() + (data.expires_in || 3600) * 1000);

      return this.accessToken;
    } catch (error) {
      this.logger.error({ message: 'Error getting Sylius OAuth token' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get authorization headers
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    let token = this.config.accessToken as string;

    if (!token) {
      token = (await this.getOAuthToken()) || '';
    }

    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Normalize URL
   */
  private normalizeUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
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
