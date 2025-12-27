import { Category } from '../CategoryServiceInterface';
import { BaseCategoryService } from './BaseCategoryService';
import { PlatformConfigRequirements } from './PlatformCategoryServiceInterface';

/**
 * WooCommerce-specific category service implementation
 * In WooCommerce, categories are called "product_cat" taxonomy terms
 */
export class WooCommerceCategoryService extends BaseCategoryService {
  /**
   * Get configuration requirements for WooCommerce
   */
  getConfigRequirements(): PlatformConfigRequirements {
    return {
      required: ['storeUrl', 'apiKey', 'apiSecret'],
      optional: [],
    };
  }

  /**
   * Get all categories from WooCommerce
   */
  async getCategories(): Promise<Category[]> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce category service not initialized');
    }

    try {
      const url = `${this.config.storeUrl}/wp-json/wc/v3/products/categories?per_page=100`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch WooCommerce categories: ${response.statusText}`);
      }

      const categories = await response.json();

      // Convert WooCommerce categories to our format
      return this.buildCategoryTree(categories);
    } catch (error) {
      console.error('Error fetching WooCommerce categories:', error);
      return [];
    }
  }

  /**
   * Get a specific category by ID from WooCommerce
   */
  async getCategoryById(categoryId: string): Promise<Category | undefined> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce category service not initialized');
    }

    try {
      const url = `${this.config.storeUrl}/wp-json/wc/v3/products/categories/${categoryId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        }
        throw new Error(`Failed to fetch WooCommerce category: ${response.statusText}`);
      }

      const category = await response.json();
      return this.mapWooCommerceCategory(category);
    } catch (error) {
      console.error(`Error fetching WooCommerce category ${categoryId}:`, error);
      return undefined;
    }
  }

  /**
   * Create a new category in WooCommerce
   */
  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce category service not initialized');
    }

    try {
      const url = `${this.config.storeUrl}/wp-json/wc/v3/products/categories`;

      // Format category data for WooCommerce
      const requestData = {
        name: category.name,
        description: category.description || '',
        parent: category.parentId ? parseInt(category.parentId, 10) : 0,
        image: category.image ? { src: category.image } : undefined,
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
        throw new Error(`Failed to create WooCommerce category: ${response.statusText} - ${errorText}`);
      }

      const newCategory = await response.json();
      return this.mapWooCommerceCategory(newCategory);
    } catch (error) {
      console.error('Error creating WooCommerce category:', error);
      throw new Error(`Failed to create category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing category in WooCommerce
   */
  async updateCategory(categoryId: string, categoryData: Partial<Category>): Promise<Category> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce category service not initialized');
    }

    try {
      const url = `${this.config.storeUrl}/wp-json/wc/v3/products/categories/${categoryId}`;

      // Format category data for WooCommerce
      const requestData: Record<string, any> = {};

      if (categoryData.name !== undefined) {
        requestData.name = categoryData.name;
      }

      if (categoryData.description !== undefined) {
        requestData.description = categoryData.description;
      }

      if (categoryData.parentId !== undefined) {
        requestData.parent = parseInt(categoryData.parentId, 10);
      }

      if (categoryData.image !== undefined) {
        requestData.image = { src: categoryData.image };
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
        throw new Error(`Failed to update WooCommerce category: ${response.statusText}`);
      }

      const updatedCategory = await response.json();
      return this.mapWooCommerceCategory(updatedCategory);
    } catch (error) {
      console.error(`Error updating WooCommerce category ${categoryId}:`, error);
      throw new Error(`Failed to update category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a category from WooCommerce
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('WooCommerce category service not initialized');
    }

    try {
      const url = `${this.config.storeUrl}/wp-json/wc/v3/products/categories/${categoryId}?force=true`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      return response.ok;
    } catch (error) {
      console.error(`Error deleting WooCommerce category ${categoryId}:`, error);
      return false;
    }
  }

  /**
   * Map a WooCommerce category to our Category interface
   */
  private mapWooCommerceCategory(category: any): Category {
    return {
      id: category.id.toString(),
      name: category.name || '',
      description: category.description || '',
      parentId: category.parent ? category.parent.toString() : undefined,
      image: category.image?.src,
    };
  }

  /**
   * Build a category tree from WooCommerce categories
   */
  private buildCategoryTree(categories: any[]): Category[] {
    // First map all categories
    const mappedCategories = categories.map(cat => this.mapWooCommerceCategory(cat));

    // Create a flat list of all categories
    return mappedCategories;
  }

  /**
   * Create authorization headers for WooCommerce API
   * WooCommerce REST API uses Basic Auth
   */
  private getAuthHeaders(): Record<string, string> {
    const credentials = `${this.config.apiKey}:${this.config.apiSecret}`;
    const encodedCredentials = Buffer.from(credentials).toString('base64');

    return {
      Authorization: `Basic ${encodedCredentials}`,
      'Content-Type': 'application/json',
    };
  }
}
