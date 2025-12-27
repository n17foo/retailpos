import { Category, CategoryServiceInterface } from '../CategoryServiceInterface';
import { LoggerFactory } from '../../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CATEGORIES_STORAGE_KEY = 'custom_local_categories';

/**
 * Custom/Local category service for offline-first POS operation
 * Categories are downloaded along with menu and stored locally
 */
export class CustomCategoryService implements CategoryServiceInterface {
  private initialized: boolean = false;
  private categories: Category[] = [];
  private logger = LoggerFactory.getInstance().createLogger('CustomCategoryService');

  /**
   * Initialize the custom category service
   * Loads categories from local storage
   */
  async initialize(): Promise<boolean> {
    try {
      const storedCategories = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (storedCategories) {
        this.categories = JSON.parse(storedCategories);
        this.logger.info(`Loaded ${this.categories.length} categories from local storage`);
      }

      this.initialized = true;
      this.logger.info('Custom category service initialized (local-only mode)');
      return true;
    } catch (error) {
      this.logger.error(
        { message: 'Error initializing custom category service' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get categories from local storage
   */
  async getCategories(): Promise<Category[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.categories;
  }

  /**
   * Set categories (called after downloading menu)
   */
  async setCategories(categories: Category[]): Promise<void> {
    this.categories = categories.map((cat, index) => this.mapToCategory(cat, index));
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));
    this.logger.info(`Saved ${this.categories.length} categories to local storage`);
  }

  /**
   * Add a new category locally
   */
  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const newCategory: Category = {
      ...category,
      id: `local-cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.categories.push(newCategory);
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));

    this.logger.info(`Added local category: ${newCategory.name}`);
    return newCategory;
  }

  /**
   * Update an existing category
   */
  async updateCategory(categoryId: string, data: Partial<Category>): Promise<Category> {
    const index = this.categories.findIndex(c => c.id === categoryId);
    if (index === -1) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    const updated = {
      ...this.categories[index],
      ...data,
      id: categoryId, // Ensure ID doesn't change
    };

    this.categories[index] = updated;
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));

    this.logger.info(`Updated local category: ${updated.name}`);
    return updated;
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    const index = this.categories.findIndex(c => c.id === categoryId);
    if (index === -1) {
      return false;
    }

    this.categories.splice(index, 1);
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));

    this.logger.info(`Deleted local category: ${categoryId}`);
    return true;
  }

  /**
   * Clear all local categories
   */
  async clearLocalCategories(): Promise<void> {
    this.categories = [];
    await AsyncStorage.removeItem(CATEGORIES_STORAGE_KEY);
    this.logger.info('Cleared all local categories');
  }

  /**
   * Map external category format to standard Category format
   */
  private mapToCategory(item: any, index: number): Category {
    return {
      id: item.id?.toString() || `cat-${index}-${Date.now()}`,
      name: item.name || item.title || 'Uncategorized',
      description: item.description || '',
      parentId: item.parentId || item.parent_id || undefined,
      image: item.image || item.imageUrl || undefined,
      subcategories: item.subcategories?.map((sub: any, subIndex: number) => this.mapToCategory(sub, subIndex)),
    };
  }
}

export const customCategoryService = new CustomCategoryService();
