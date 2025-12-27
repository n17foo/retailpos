import { InventoryServiceInterface, InventoryResult, InventoryUpdate, InventoryUpdateResult } from '../InventoryServiceInterface';
import { MockProductService } from '../../product/mock/MockProductService';
import { Product } from '../../product/ProductServiceInterface';

export class MockInventoryService implements InventoryServiceInterface {
  private inventory: Map<string, number> = new Map(); // variantId -> quantity
  private products: Map<string, Product> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private async initializeMockData(): Promise<void> {
    const productService = new MockProductService();
    const productResult = await productService.getProducts({ limit: 100 });
    productResult.products.forEach(p => {
      this.products.set(p.id, p);
      p.variants.forEach(v => {
        this.inventory.set(v.id, v.inventoryQuantity);
      });
    });
  }

  async getInventory(productIds: string[]): Promise<InventoryResult> {
    const items: InventoryResult['items'] = [];
    for (const productId of productIds) {
      const product = this.products.get(productId);
      if (product) {
        for (const variant of product.variants) {
          items.push({
            productId: product.id,
            variantId: variant.id,
            quantity: this.inventory.get(variant.id) || 0,
            sku: variant.sku,
            updatedAt: new Date(),
          });
        }
      }
    }
    return Promise.resolve({ items });
  }

  async updateInventory(updates: InventoryUpdate[]): Promise<InventoryUpdateResult> {
    let successful = 0;
    let failed = 0;
    const errors: any[] = [];

    for (const update of updates) {
      const variantId = update.variantId;
      if (variantId && this.inventory.has(variantId)) {
        if (update.adjustment) {
          const currentQuantity = this.inventory.get(variantId) || 0;
          this.inventory.set(variantId, currentQuantity + update.quantity);
        } else {
          this.inventory.set(variantId, update.quantity);
        }
        successful++;
      } else {
        failed++;
        errors.push({ productId: update.productId, variantId, error: 'Variant not found' });
      }
    }

    return Promise.resolve({ successful, failed, errors });
  }
}
