import { Category, CategoryServiceInterface } from '../CategoryServiceInterface';

export class MockCategoryService implements CategoryServiceInterface {
  private mockCategories: Category[] = [
    // Root categories
    { id: '1', name: 'Electronics' },
    { id: '2', name: 'Clothing' },
    { id: '3', name: 'Books' },
    { id: '4', name: 'Furniture' },
    { id: '5', name: 'Home & Garden' },

    // Subcategories for Electronics
    { id: '1-1', name: 'Phones', parentId: '1' },
    { id: '1-2', name: 'Laptops', parentId: '1' },

    // Subcategories for Furniture
    { id: '4-1', name: 'Chairs', parentId: '4' },
  ];

  async getCategories(): Promise<Category[]> {
    return Promise.resolve(this.mockCategories);
  }
}
