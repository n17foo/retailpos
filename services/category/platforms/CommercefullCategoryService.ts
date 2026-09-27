/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Category } from '../CategoryServiceInterface';
import { PlatformCategoryServiceInterface, PlatformCategoryConfig, PlatformConfigRequirements } from './PlatformCategoryServiceInterface';
import { CommercefullApiClient, CommercefullConfig } from '../../clients/commercefull/CommercefullApiClient';
import { LoggerFactory } from '../../logger/LoggerFactory';

/**
 * Commercefull platform implementation of the category service.
 *
 * Endpoint mapping:
 *   GET  /customer/categories                      → getCategories (all active)
 *   GET  /customer/categories/:identifier          → getCategoryById (by ID or slug)
 *   GET  /customer/categories/:categoryId/children → subcategories
 */
export class CommercefullCategoryService implements PlatformCategoryServiceInterface {
  private initialized = false;
  private config: PlatformCategoryConfig = {};
  private apiClient: CommercefullApiClient;
  private logger = LoggerFactory.getInstance().createLogger('CommercefullCategoryService');
  private cachedCategories: Category[] = [];
  private lastFetch = 0;
  private cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(config: PlatformCategoryConfig = {}) {
    this.config = config;
    this.apiClient = CommercefullApiClient.getInstance();
  }

  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: ['apiVersion'],
    };
  }

  async initialize(config?: PlatformCategoryConfig): Promise<void> {
    try {
      if (config) this.config = config;

      const clientConfig: CommercefullConfig = {
        storeUrl: this.config.storeUrl,
        apiKey: this.config.apiKey || this.config.accessToken,
        apiSecret: this.config.apiSecret,
        apiVersion: this.config.apiVersion,
      };

      this.apiClient.configure(clientConfig);
      const ok = await this.apiClient.initialize();
      if (ok) this.initialized = true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to initialize Commercefull category service' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getCategories(): Promise<Category[]> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull category service not initialized');
    }

    // Return cached if fresh
    if (this.cachedCategories.length > 0 && Date.now() - this.lastFetch < this.cacheTtlMs) {
      return this.cachedCategories;
    }

    try {
      const data = await this.apiClient.get<any>('/customer/categories');
      const categories = data.data || data.categories || data || [];

      this.cachedCategories = categories.map((c: any) => this.mapCategory(c));

      // The platform returns a flat list — attach children via parentId.
      const byId = new Map(this.cachedCategories.map(c => [c.id, c]));
      for (const c of this.cachedCategories) {
        if (c.parentId && byId.has(c.parentId)) {
          const parent = byId.get(c.parentId)!;
          parent.subcategories = [...(parent.subcategories || []), c];
        }
      }
      this.lastFetch = Date.now();

      return this.cachedCategories;
    } catch (error) {
      this.logger.error(
        { message: 'Error fetching categories from Commercefull' },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    if (!this.isInitialized()) {
      throw new Error('Commercefull category service not initialized');
    }

    try {
      const data = await this.apiClient.get<any>(`/customer/categories/${encodeURIComponent(categoryId)}`);
      const cat = data.data || data;
      if (!cat) return undefined;
      return this.mapCategory(cat);
    } catch {
      // Fall back to cached list lookup
      const categories = await this.getCategories();
      return categories.find(c => c.id === categoryId);
    }
  }

  private mapCategory(c: any): Category {
    return {
      id: c.productCategoryId || c.categoryId || c.id || '',
      name: c.name || '',
      description: c.description,
      parentId: c.parentId,
      image: c.imageUrl || c.iconUrl,
      subcategories: c.children?.map((child: any) => this.mapCategory(child)),
    };
  }
}
