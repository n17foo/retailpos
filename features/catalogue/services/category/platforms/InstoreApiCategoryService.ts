import { instoreApiClient } from '../../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { serverDataCache } from '../../../../multi-register/services/offline/ServerDataCache';
import { isStoreApiUnavailable } from '../../../../multi-register/services/offline/isStoreApiUnavailable';
import { Category, CategoryServiceInterface } from '../CategoryServiceInterface';
import { LoggerFactory } from '../../../../../shared/services/logger/LoggerFactory';

/**
 * Store API-backed category service for multi-register deployments.
 * Mirrors the OfflineCategoryService surface so management hooks can swap it
 * in unchanged — all registers share one category tree on the server.
 */
export class InstoreApiCategoryService implements CategoryServiceInterface {
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiCategoryService');

  async initialize(): Promise<boolean> {
    return true;
  }

  isInitialized(): boolean {
    return true;
  }

  async getCategories(): Promise<Category[]> {
    try {
      const categories = await instoreApiClient.getCategories();
      await serverDataCache.mergeCategories(categories);
      return categories;
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      const cached = await serverDataCache.getCategories<Category>();
      if (!cached) throw error;
      return cached;
    }
  }

  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const created = await instoreApiClient.createCategory(category);
    this.logger.info(`Created shared category: ${created.name}`);
    return created;
  }

  async updateCategory(categoryId: string, data: Partial<Category>): Promise<Category> {
    return instoreApiClient.updateCategory(categoryId, data);
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    try {
      await instoreApiClient.deleteCategory(categoryId);
      await serverDataCache.removeCategory(categoryId);
      return true;
    } catch {
      return false;
    }
  }

  /** Replace the shared category tree (explicit admin action — affects all registers). */
  async setCategories(categories: Category[]): Promise<void> {
    const existing = await instoreApiClient.getCategories();
    const wanted = new Set(categories.map(c => c.id));
    for (const current of existing) {
      if (!wanted.has(current.id)) {
        await instoreApiClient.deleteCategory(current.id);
      }
    }
    for (const category of categories) {
      if (existing.some(c => c.id === category.id)) {
        await instoreApiClient.updateCategory(category.id, category);
      } else {
        await instoreApiClient.createCategory(category);
      }
    }
  }

  async clearLocalCategories(): Promise<void> {
    const existing = await instoreApiClient.getCategories();
    for (const category of existing) {
      await instoreApiClient.deleteCategory(category.id);
    }
  }
}

export const instoreApiCategoryService = new InstoreApiCategoryService();
