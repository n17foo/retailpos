/* eslint-disable @typescript-eslint/no-explicit-any -- raw platform API response mapping */
import { Category } from '../CategoryServiceInterface';
import { BaseCategoryService } from './BaseCategoryService';
import { PlatformConfigRequirements } from './PlatformCategoryServiceInterface';
import { BigCommerceApiClient } from '../../clients/bigcommerce/BigCommerceApiClient';

/**
 * BigCommerce-specific category service implementation
 * Handles category operations for BigCommerce platform
 */
export class BigCommerceCategoryService extends BaseCategoryService {
  private apiClient = BigCommerceApiClient.getInstance();
  /**
   * Get configuration requirements for BigCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeHash', 'accessToken', 'clientId'],
      optional: [],
    };
  }

  /**
   * Get all categories from BigCommerce
   */
  async getCategories(): Promise<Category[]> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce category service not initialized');
    }

    try {
      const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/categories`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch BigCommerce categories: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      // Map BigCommerce categories to our format and build category tree
      return this.mapCategories(data.data);
    } catch (error) {
      this.logger.error({ message: 'Error fetching BigCommerce categories:' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get a specific category by ID from BigCommerce
   */
  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce category service not initialized');
    }

    try {
      const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/categories/${categoryId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        }
        throw new Error(`Failed to fetch BigCommerce category: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data) {
        return undefined;
      }

      return this.mapCategory(data.data);
    } catch (error) {
      this.logger.error(
        { message: `Error fetching BigCommerce category ${categoryId}:` },
        error instanceof Error ? error : new Error(String(error))
      );
      return undefined;
    }
  }

  /**
   * Create a new category in BigCommerce
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce category service not initialized');
    }

    try {
      const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/categories`;

      // Format category data for BigCommerce
      const requestData = {
        name: category.name,
        description: category.description || '',
        parent_id: category.parentId ? parseInt(category.parentId, 10) : 0,
        image_url: category.image,
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
        throw new Error(`Failed to create BigCommerce category: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.data) {
        throw new Error('Failed to create category: No data returned');
      }

      return this.mapCategory(data.data);
    } catch (error) {
      this.logger.error({ message: 'Error creating BigCommerce category:' }, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Failed to create category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing category in BigCommerce
   */
  async updateCategory(categoryId: string, categoryData: Partial<Category>): Promise<Category> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce category service not initialized');
    }

    try {
      const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/categories/${categoryId}`;

      // Format category data for BigCommerce
      const requestData: Record<string, any> = {};

      if (categoryData.name !== undefined) {
        requestData.name = categoryData.name;
      }

      if (categoryData.description !== undefined) {
        requestData.description = categoryData.description;
      }

      if (categoryData.parentId !== undefined) {
        requestData.parent_id = parseInt(categoryData.parentId, 10);
      }

      if (categoryData.image !== undefined) {
        requestData.image_url = categoryData.image;
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update BigCommerce category: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data) {
        throw new Error('Failed to update category: No data returned');
      }

      return this.mapCategory(data.data);
    } catch (error) {
      this.logger.error(
        { message: `Error updating BigCommerce category ${categoryId}:` },
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error(`Failed to update category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a category from BigCommerce
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('BigCommerce category service not initialized');
    }

    try {
      const url = `https://api.bigcommerce.com/stores/${this.config.storeHash}/v3/catalog/categories/${categoryId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      return response.ok;
    } catch (error) {
      this.logger.error(
        { message: `Error deleting BigCommerce category ${categoryId}:` },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Map a BigCommerce category to our Category interface
   */
  private mapCategory(category: any): Category {
    return {
      id: category.id.toString(),
      name: category.name || '',
      description: category.description || '',
      parentId: category.parent_id > 0 ? category.parent_id.toString() : undefined,
      image: category.image_url,
    };
  }

  /**
   * Map BigCommerce categories and build proper hierarchy
   */
  private mapCategories(categories: any[]): Category[] {
    // First map all categories
    return categories.map(category => this.mapCategory(category));
  }

  /**
   * Create authorization headers for BigCommerce API
   */
  private getAuthHeaders(): Record<string, string> {
    return this.apiClient['buildHeaders']();
  }
}
