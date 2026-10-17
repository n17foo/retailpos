import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import InventoryCountScreen from './InventoryCountScreen';
import { inventoryCountService } from '../services/InventoryCountService';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'offline' } }),
}));

jest.mock('../services/InventoryCountService', () => ({
  inventoryCountService: {
    findAllCounts: jest.fn(),
    findCountItems: jest.fn(),
    updateCountedQty: jest.fn(),
    finaliseCount: jest.fn(),
    discardCount: jest.fn(),
  },
}));

describe('InventoryCountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (inventoryCountService.findAllCounts as jest.Mock).mockResolvedValue([
      { id: 'cnt-87654321', status: 'in_progress', started_at: 1700000000000, completed_at: null },
    ]);
    (inventoryCountService.findCountItems as jest.Mock).mockResolvedValue([
      { id: 'ci-1', count_id: 'cnt-87654321', product_name: 'Chai Syrup', sku: 'CS-1', expected_qty: 12, counted_qty: 11 },
    ]);
  });

  it('lists count sessions and opens active stock-take session on tap', async () => {
    const tree = await renderUi(<InventoryCountScreen />);
    expect(hasText(tree, 'Count #87654321')).toBe(true);

    await pressByText(tree, 'Count #87654321');
    expect(hasText(tree, 'Stock Take')).toBe(true);
    expect(hasText(tree, 'Chai Syrup')).toBe(true);
    expect(hasText(tree, 'Finalise Count')).toBe(true);
  });
});
