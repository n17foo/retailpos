import { Category, CategoryServiceInterface } from '../CategoryServiceInterface';
import { PlatformCategoryServiceInterface } from './PlatformCategoryServiceInterface';

/**
 * Composite service that aggregates multiple platform-specific category services
 * Allows querying and managing categories across multiple e-commerce platforms
 */
export class CompositeCategoryService implements CategoryServiceInterface {
  /**
   * The platform-specific services this composite will delegate to
   */
  private services: PlatformCategoryServiceInterface[];

  /**
   * Create a new composite category service
   * @param services Array of platform-specific category services
   */
  constructor(services: PlatformCategoryServiceInterface[]) {
    this.services = services;

    if (services.length === 0) {
      console.warn('CompositeCategoryService created with no services');
    }
  }

  /**
   * Get all categories from all platforms
   * @returns Promise resolving to combined categories from all platforms
   */
  async getCategories(): Promise<Category[]> {
    // Execute getCategories on all services concurrently
    const categoryPromises = this.services.map(service => {
      try {
        return service.getCategories();
      } catch (error) {
        console.error('Error getting categories from service:', error);
        return Promise.resolve([]);
      }
    });

    // Wait for all requests to complete
    const categorySets = await Promise.all(categoryPromises);

    // Combine all categories into a single array
    // Map platform-specific IDs to avoid conflicts
    const combinedCategories: Category[] = [];
    let serviceIndex = 0;

    for (const categories of categorySets) {
      const platformPrefix = `p${serviceIndex}_`;
      serviceIndex++;

      // Add platform-specific prefix to IDs to avoid conflicts
      const prefixedCategories = categories.map(category => ({
        ...category,
        id: platformPrefix + category.id,
        parentId: category.parentId ? platformPrefix + category.parentId : undefined,
        _originalId: category.id,
        _platform: serviceIndex - 1,
        subcategories: category.subcategories
          ? category.subcategories.map(sub => ({
              ...sub,
              id: platformPrefix + sub.id,
              parentId: sub.parentId ? platformPrefix + sub.parentId : undefined,
              _originalId: sub.id,
              _platform: serviceIndex - 1,
            }))
          : undefined,
      }));

      combinedCategories.push(...prefixedCategories);
    }

    return combinedCategories;
  }

  /**
   * Get a specific category by ID from any platform
   * @param categoryId The ID of the category to retrieve
   * @returns Promise resolving to the category or undefined if not found
   */
  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    // Check if this is a prefixed ID (from getCategories)
    if (categoryId.startsWith('p') && categoryId.indexOf('_') > 0) {
      const parts = categoryId.split('_');
      const platformIndex = parseInt(parts[0].substring(1), 10);
      const originalId = parts[1];

      if (!isNaN(platformIndex) && platformIndex >= 0 && platformIndex < this.services.length) {
        try {
          const category = await this.services[platformIndex].getCategoryById(originalId);
          if (category) {
            return {
              ...category,
              id: categoryId,
              _originalId: originalId,
              _platform: platformIndex,
            };
          }
        } catch (error) {
          console.error(`Error getting category ${originalId} from platform ${platformIndex}:`, error);
        }
      }
      return undefined;
    }

    // If not a prefixed ID, try each service until we find it
    for (let i = 0; i < this.services.length; i++) {
      try {
        const category = await this.services[i].getCategoryById(categoryId);
        if (category) {
          return {
            ...category,
            _originalId: category.id,
            _platform: i,
          };
        }
      } catch (error) {
        console.error(`Error getting category ${categoryId} from service ${i}:`, error);
      }
    }

    return undefined;
  }

  /**
   * Create a new category on the first available platform that supports creation
   * @param category Category data to create
   * @returns Promise resolving to the created category
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    // Find the first service that implements createCategory
    for (let i = 0; i < this.services.length; i++) {
      const service = this.services[i];
      if (service.createCategory) {
        try {
          const createdCategory = await service.createCategory(category);
          return {
            ...createdCategory,
            _originalId: createdCategory.id,
            _platform: i,
          };
        } catch (error) {
          console.error('Error creating category:', error);
        }
      }
    }

    throw new Error('No services available that support category creation');
  }

  /**
   * Update an existing category
   * @param categoryId ID of the category to update
   * @param categoryData Updated category data
   * @returns Promise resolving to the updated category
   */
  async updateCategory(categoryId: string, categoryData: Partial<Category>): Promise<Category> {
    // Check if this is a prefixed ID (from getCategories)
    if (categoryId.startsWith('p') && categoryId.indexOf('_') > 0) {
      const parts = categoryId.split('_');
      const platformIndex = parseInt(parts[0].substring(1), 10);
      const originalId = parts[1];

      if (!isNaN(platformIndex) && platformIndex >= 0 && platformIndex < this.services.length) {
        const service = this.services[platformIndex];
        if (service.updateCategory) {
          const updatedCategory = await service.updateCategory(originalId, categoryData);
          return {
            ...updatedCategory,
            id: categoryId,
            _originalId: originalId,
            _platform: platformIndex,
          };
        } else {
          throw new Error(`Platform ${platformIndex} does not support updating categories`);
        }
      }
    }

    throw new Error(`Invalid category ID or platform does not support category updates`);
  }

  /**
   * Delete a category
   * @param categoryId ID of the category to delete
   * @returns Promise resolving to true if successful
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    // Check if this is a prefixed ID (from getCategories)
    if (categoryId.startsWith('p') && categoryId.indexOf('_') > 0) {
      const parts = categoryId.split('_');
      const platformIndex = parseInt(parts[0].substring(1), 10);
      const originalId = parts[1];

      if (!isNaN(platformIndex) && platformIndex >= 0 && platformIndex < this.services.length) {
        const service = this.services[platformIndex];
        if (service.deleteCategory) {
          return await service.deleteCategory(originalId);
        } else {
          throw new Error(`Platform ${platformIndex} does not support deleting categories`);
        }
      }
    }

    throw new Error(`Invalid category ID or platform does not support category deletion`);
  }
}
