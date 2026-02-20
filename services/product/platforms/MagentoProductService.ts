/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Product, ProductQueryOptions, ProductResult, SyncResult } from '../ProductServiceInterface';
import { PlatformProductConfig, PlatformConfigRequirements } from './PlatformProductServiceInterface';
import { BaseProductService } from './BaseProductService';
import { ECommercePlatform } from '../../../utils/platforms';
import { TokenInitializer } from '../../token/TokenInitializer';
import { withTokenRefresh } from '../../token/TokenIntegration';
import { LoggerFactory } from '../../logger/LoggerFactory';
import { MAGENTO_API_VERSION } from '../../config/apiVersions';

/**
 * Magento-specific implementation of the product service
 * Supports Magento 2.x REST API
 */
export class MagentoProductService extends BaseProductService {
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;

  constructor(config: PlatformProductConfig = {}) {
    super(config);
    this.logger = LoggerFactory.getInstance().createLogger('MagentoProductService');
  }

  /**
   * Initialize the Magento product service
   */
  async initialize(): Promise<boolean> {
    try {
      // Set up configuration from constructor or environment variables
      this.config.storeUrl = this.config.storeUrl || process.env.MAGENTO_STORE_URL || '';
      this.config.username = this.config.username || process.env.MAGENTO_USERNAME || '';
      this.config.password = this.config.password || process.env.MAGENTO_PASSWORD || '';
      this.config.accessToken = this.config.accessToken || process.env.MAGENTO_ACCESS_TOKEN || '';
      this.config.apiVersion = this.config.apiVersion || process.env.MAGENTO_API_VERSION || MAGENTO_API_VERSION;

      // Normalize store URL
      this.config.storeUrl = this.normalizeStoreUrl(this.config.storeUrl as string);

      if (!this.config.storeUrl) {
        this.logger.warn('Missing Magento store URL configuration');
        return false;
      }

      // Initialize token provider
      await TokenInitializer.getInstance().initializePlatformToken(ECommercePlatform.MAGENTO);

      // Get authentication token if not using access token
      if (!this.config.accessToken && this.config.username && this.config.password) {
        const token = await this.getAuthToken();
        if (!token) {
          this.logger.error({ message: 'Failed to authenticate with Magento' });
          return false;
        }
      }

      // Test connection
      try {
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products?searchCriteria[pageSize]=1`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (response.ok) {
          this.initialized = true;
          return true;
        } else {
          const errorText = await response.text();
          this.logger.error(
            { message: 'Failed to connect to Magento API' },
            new Error(`Status: ${response.status}, Response: ${errorText}`)
          );
          return false;
        }
      } catch (error) {
        this.logger.error({ message: 'Error connecting to Magento API' }, error instanceof Error ? error : new Error(String(error)));
        return false;
      }
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Magento product service' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Get configuration requirements for Magento
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl'],
      optional: ['username', 'password', 'accessToken', 'apiVersion'],
      description: 'Magento requires store URL and either username/password or access token for authentication',
    };
  }

  /**
   * Get products from Magento
   */
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
      try {
        const params = new URLSearchParams();

        // Pagination
        params.append('searchCriteria[pageSize]', String(options.limit || 20));
        params.append('searchCriteria[currentPage]', String(options.page || 1));

        // Search filter
        if (options.search) {
          params.append('searchCriteria[filter_groups][0][filters][0][field]', 'name');
          params.append('searchCriteria[filter_groups][0][filters][0][value]', `%${options.search}%`);
          params.append('searchCriteria[filter_groups][0][filters][0][condition_type]', 'like');
        }

        // Category filter
        if (options.category) {
          const filterIndex = options.search ? '1' : '0';
          params.append(`searchCriteria[filter_groups][${filterIndex}][filters][0][field]`, 'category_id');
          params.append(`searchCriteria[filter_groups][${filterIndex}][filters][0][value]`, options.category);
          params.append(`searchCriteria[filter_groups][${filterIndex}][filters][0][condition_type]`, 'eq');
        }

        // IDs filter
        if (options.ids && options.ids.length > 0) {
          const filterIndex = (options.search ? 1 : 0) + (options.category ? 1 : 0);
          params.append(`searchCriteria[filter_groups][${filterIndex}][filters][0][field]`, 'entity_id');
          params.append(`searchCriteria[filter_groups][${filterIndex}][filters][0][value]`, options.ids.join(','));
          params.append(`searchCriteria[filter_groups][${filterIndex}][filters][0][condition_type]`, 'in');
        }

        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products?${params.toString()}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          throw new Error(`Failed to fetch products from Magento: ${response.statusText}`);
        }

        const data = await response.json();

        // Map Magento products to our format
        const products = (data.items || []).map((magentoProduct: any) => this.mapToProduct(magentoProduct));

        return {
          products,
          pagination: {
            currentPage: options.page || 1,
            totalPages: Math.ceil((data.total_count || 0) / (options.limit || 20)),
            totalItems: data.total_count || 0,
            perPage: options.limit || 20,
          },
        };
      } catch (error) {
        this.logger.error({ message: 'Error fetching products from Magento' }, error instanceof Error ? error : new Error(String(error)));
        return {
          products: [],
          pagination: { currentPage: 1, totalPages: 0, totalItems: 0, perPage: options.limit || 20 },
        };
      }
    });
  }

  /**
   * Get a single product by ID
   */
  async getProductById(productId: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
      try {
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products/${productId}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from Magento: ${response.statusText}`);
        }

        const magentoProduct = await response.json();
        return this.mapToProduct(magentoProduct);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product ${productId} from Magento` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  /**
   * Get product by SKU (Magento's preferred identifier)
   */
  async getProductBySku(sku: string): Promise<Product | null> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
      try {
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products/${encodeURIComponent(sku)}`;
        const headers = await this.getAuthHeaders();
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`Failed to fetch product from Magento: ${response.statusText}`);
        }

        const magentoProduct = await response.json();
        return this.mapToProduct(magentoProduct);
      } catch (error) {
        this.logger.error(
          { message: `Error fetching product by SKU ${sku} from Magento` },
          error instanceof Error ? error : new Error(String(error))
        );
        return null;
      }
    });
  }

  /**
   * Create a new product on Magento
   */
  async createProduct(product: Product): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
      try {
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products`;
        const magentoProduct = this.mapToMagentoProduct(product);
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product: magentoProduct }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create product on Magento: ${response.statusText} - ${errorText}`);
        }

        const createdProduct = await response.json();
        return this.mapToProduct(createdProduct);
      } catch (error) {
        this.logger.error({ message: 'Error creating product on Magento' }, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    });
  }

  /**
   * Update a product on Magento
   */
  async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
      try {
        // Get existing product first
        const existingProduct = await this.getProductById(productId);
        if (!existingProduct) {
          throw new Error(`Product with ID ${productId} not found`);
        }

        // Merge and convert
        const updatedProduct = { ...existingProduct, ...productData };
        const magentoProduct = this.mapToMagentoProduct(updatedProduct);

        // Use SKU for Magento API
        const sku = updatedProduct.variants[0]?.sku || productId;
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products/${encodeURIComponent(sku)}`;
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product: magentoProduct }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update product on Magento: ${response.statusText}`);
        }

        const updated = await response.json();
        return this.mapToProduct(updated);
      } catch (error) {
        this.logger.error(
          { message: `Error updating product ${productId} on Magento` },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    });
  }

  /**
   * Delete a product from Magento
   */
  async deleteProduct(productId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    return withTokenRefresh(ECommercePlatform.MAGENTO, async () => {
      try {
        // Get SKU first (Magento deletes by SKU)
        const product = await this.getProductById(productId);
        if (!product) {
          return false;
        }

        const sku = product.variants[0]?.sku || productId;
        const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/products/${encodeURIComponent(sku)}`;
        const headers = await this.getAuthHeaders();

        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers,
        });

        return response.ok;
      } catch (error) {
        this.logger.error(
          { message: `Error deleting product ${productId} from Magento` },
          error instanceof Error ? error : new Error(String(error))
        );
        return false;
      }
    });
  }

  /**
   * Sync products with Magento
   */
  async syncProducts(products: Product[]): Promise<SyncResult> {
    if (!this.isInitialized()) {
      throw new Error('Magento product service not initialized');
    }

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const product of products) {
      try {
        const sku = product.variants[0]?.sku;
        if (!sku) {
          throw new Error('Product must have a SKU for Magento sync');
        }

        // Check if product exists
        const existing = await this.getProductBySku(sku);

        if (existing) {
          await this.updateProduct(existing.id, product);
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
   * Get admin authentication token
   */
  private async getAuthToken(): Promise<string | null> {
    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpiration && this.tokenExpiration > new Date()) {
      return this.accessToken;
    }

    try {
      const apiUrl = `${this.config.storeUrl}/rest/${this.config.apiVersion}/integration/admin/token`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      });

      if (!response.ok) {
        this.logger.error({ message: 'Failed to get Magento auth token' });
        return null;
      }

      const token = await response.json();

      // Cache the token (Magento tokens typically last 4 hours)
      this.accessToken = token;
      this.tokenExpiration = new Date(Date.now() + 4 * 60 * 60 * 1000);

      return token;
    } catch (error) {
      this.logger.error({ message: 'Error getting Magento auth token' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get authorization headers
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    let token = this.config.accessToken as string;

    if (!token) {
      token = (await this.getAuthToken()) || '';
    }

    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Normalize store URL
   */
  private normalizeStoreUrl(url: string): string {
    if (!url) return '';
    url = url.replace(/\/$/, '');
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    return url;
  }

  /**
   * Map Magento product to our format
   */
  protected mapToProduct(magentoProduct: any): Product {
    // Extract custom attributes
    const getCustomAttribute = (code: string) => {
      const attr = magentoProduct.custom_attributes?.find((a: any) => a.attribute_code === code);
      return attr?.value;
    };

    // Build variants from configurable options or simple product
    const variants = [
      {
        id: String(magentoProduct.id),
        title: 'Default',
        sku: magentoProduct.sku || '',
        barcode: getCustomAttribute('barcode'),
        price: parseFloat(magentoProduct.price || '0'),
        compareAtPrice: getCustomAttribute('special_price') ? parseFloat(getCustomAttribute('special_price')) : undefined,
        inventoryQuantity: magentoProduct.extension_attributes?.stock_item?.qty || 0,
        weight: magentoProduct.weight ? parseFloat(magentoProduct.weight) : undefined,
        weightUnit: 'kg' as const,
      },
    ];

    // Extract images
    const images = (magentoProduct.media_gallery_entries || []).map((entry: any) => ({
      id: String(entry.id),
      url: `${this.config.storeUrl}/pub/media/catalog/product${entry.file}`,
      alt: entry.label || '',
      position: entry.position,
    }));

    return {
      id: String(magentoProduct.id),
      title: magentoProduct.name || '',
      description: getCustomAttribute('description') || getCustomAttribute('short_description') || '',
      vendor: getCustomAttribute('manufacturer') || '',
      productType: magentoProduct.type_id || '',
      tags: [],
      options: [],
      variants,
      images,
      createdAt: magentoProduct.created_at ? new Date(magentoProduct.created_at) : undefined,
      updatedAt: magentoProduct.updated_at ? new Date(magentoProduct.updated_at) : undefined,
    };
  }

  /**
   * Map our product format to Magento format
   */
  private mapToMagentoProduct(product: Product): any {
    const primaryVariant = product.variants[0] || {
      sku: '',
      price: 0,
      inventoryQuantity: 0,
      weight: 0,
    };

    return {
      sku: primaryVariant.sku,
      name: product.title,
      price: primaryVariant.price,
      status: 1, // Enabled
      visibility: 4, // Catalog, Search
      type_id: 'simple',
      weight: primaryVariant.weight || 0,
      attribute_set_id: 4, // Default attribute set
      custom_attributes: [
        {
          attribute_code: 'description',
          value: product.description || '',
        },
        {
          attribute_code: 'short_description',
          value: product.description?.substring(0, 255) || '',
        },
      ],
      extension_attributes: {
        stock_item: {
          qty: primaryVariant.inventoryQuantity,
          is_in_stock: primaryVariant.inventoryQuantity > 0,
        },
      },
    };
  }
}
