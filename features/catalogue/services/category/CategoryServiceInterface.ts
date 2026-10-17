/**
 * Represents a product category
 */
export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  image?: string;
  subcategories?: Category[];

  // Platform-specific metadata
  _originalId?: string; // Original ID from the platform before prefixing
  _platform?: number; // Index of the platform service that provided this category
}

/**
 * Interface for category-related operations in an e-commerce platform
 */
export interface CategoryServiceInterface {
  /**
   * Get categories from the e-commerce platform
   * @returns Promise resolving to a list of categories
   */
  getCategories(): Promise<Category[]>;
}
