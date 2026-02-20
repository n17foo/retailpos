/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Category } from '../CategoryServiceInterface';
import { BaseCategoryService } from './BaseCategoryService';
import { PlatformConfigRequirements } from './PlatformCategoryServiceInterface';

/**
 * Shopify-specific category service implementation
 * In Shopify, categories are called "collections"
 */
export class ShopifyCategoryService extends BaseCategoryService {
  /**
   * Get configuration requirements for Shopify
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'accessToken'],
      optional: ['apiVersion'],
    };
  }

  /**
   * Get all categories (collections) from Shopify
   */
  async getCategories(): Promise<Category[]> {
    if (!this.isInitialized()) {
      throw new Error('Shopify category service not initialized');
    }

    try {
      // Use API version from config or default to a stable version
      const apiVersion = this.config.apiVersion || '2023-01';

      // Shopify uses collections for categorization
      // First, get custom collections
      const customCollectionsUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/custom_collections.json`;

      const customResponse = await fetch(customCollectionsUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!customResponse.ok) {
        throw new Error(`Failed to fetch Shopify custom collections: ${customResponse.statusText}`);
      }

      const customData = await customResponse.json();

      // Then get smart collections
      const smartCollectionsUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/smart_collections.json`;

      const smartResponse = await fetch(smartCollectionsUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!smartResponse.ok) {
        throw new Error(`Failed to fetch Shopify smart collections: ${smartResponse.statusText}`);
      }

      const smartData = await smartResponse.json();

      // Map collections to our category format
      const customCategories = customData.custom_collections?.map(this.mapCollectionToCategory) || [];
      const smartCategories = smartData.smart_collections?.map(this.mapCollectionToCategory) || [];

      // Combine both collection types
      return [...customCategories, ...smartCategories];
    } catch (error) {
      console.error('Error fetching Shopify categories:', error);
      return [];
    }
  }

  /**
   * Get a specific category by ID from Shopify
   */
  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    if (!this.isInitialized()) {
      throw new Error('Shopify category service not initialized');
    }

    try {
      // Use API version from config or default to a stable version
      const apiVersion = this.config.apiVersion || '2023-01';

      // Try to get as custom collection first
      const customUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/custom_collections/${categoryId}.json`;

      let response = await fetch(customUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.custom_collection) {
          return this.mapCollectionToCategory(data.custom_collection);
        }
      }

      // If not found as custom, try as smart collection
      const smartUrl = `${this.config.storeUrl}/admin/api/${apiVersion}/smart_collections/${categoryId}.json`;

      response = await fetch(smartUrl, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.smart_collection) {
          return this.mapCollectionToCategory(data.smart_collection);
        }
      }

      // Not found as either type
      return undefined;
    } catch (error) {
      console.error(`Error fetching Shopify category ${categoryId}:`, error);
      return undefined;
    }
  }

  /**
   * Create a new category in Shopify
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (!this.isInitialized()) {
      throw new Error('Shopify category service not initialized');
    }

    try {
      // Use API version from config or default to a stable version
      const apiVersion = this.config.apiVersion || '2023-01';
      const url = `${this.config.storeUrl}/admin/api/${apiVersion}/custom_collections.json`;

      // Format category data for Shopify
      const requestData = {
        custom_collection: {
          title: category.name,
          body_html: category.description || '',
          image: category.image ? { src: category.image } : undefined,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create Shopify category: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return this.mapCollectionToCategory(data.custom_collection);
    } catch (error) {
      console.error('Error creating Shopify category:', error);
      throw new Error(`Failed to create category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing category in Shopify
   */
  async updateCategory(categoryId: string, categoryData: Partial<Category>): Promise<Category> {
    if (!this.isInitialized()) {
      throw new Error('Shopify category service not initialized');
    }

    try {
      // We need to determine if this is a custom or smart collection
      const category = await this.getCategoryById(categoryId);
      if (!category) {
        throw new Error(`Category with ID ${categoryId} not found`);
      }

      // Smart collections can't be updated through the API in the same way
      // For this example, we'll focus on custom collections

      const apiVersion = this.config.apiVersion || '2023-01';
      const url = `${this.config.storeUrl}/admin/api/${apiVersion}/custom_collections/${categoryId}.json`;

      // Format category data for Shopify
      const requestData = {
        custom_collection: {
          id: categoryId,
          title: categoryData.name,
          body_html: categoryData.description,
          image: categoryData.image ? { src: categoryData.image } : undefined,
        },
      };

      // Remove undefined properties
      Object.entries(requestData.custom_collection).forEach(([key, value]) => {
        if (value === undefined) {
          delete requestData.custom_collection[key as keyof typeof requestData.custom_collection];
        }
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update Shopify category: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapCollectionToCategory(data.custom_collection);
    } catch (error) {
      console.error(`Error updating Shopify category ${categoryId}:`, error);
      throw new Error(`Failed to update category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a category from Shopify
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('Shopify category service not initialized');
    }

    try {
      // We need to determine if this is a custom or smart collection
      const category = await this.getCategoryById(categoryId);
      if (!category) {
        // Category not found, consider it already deleted
        return true;
      }

      // Use API version from config or default to a stable version
      const apiVersion = this.config.apiVersion || '2023-01';

      // Try to delete as custom collection first
      let url = `${this.config.storeUrl}/admin/api/${apiVersion}/custom_collections/${categoryId}.json`;
      let response = await fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        return true;
      }

      // If that fails, try to delete as smart collection
      url = `${this.config.storeUrl}/admin/api/${apiVersion}/smart_collections/${categoryId}.json`;
      response = await fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      return response.ok;
    } catch (error) {
      console.error(`Error deleting Shopify category ${categoryId}:`, error);
      return false;
    }
  }

  /**
   * Map a Shopify collection to our Category interface
   */
  private mapCollectionToCategory(collection: any): Category {
    return {
      id: collection.id.toString(),
      name: collection.title || '',
      description: collection.body_html || '',
      image: collection.image?.src,
      // Shopify doesn't have a direct parent-child hierarchy for collections
      // So parentId is not available here
    };
  }

  /**
   * Create authorization headers for Shopify API
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.config.accessToken || '',
      'Content-Type': 'application/json',
    };
  }
}
