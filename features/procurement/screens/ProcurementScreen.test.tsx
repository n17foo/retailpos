import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ProcurementScreen from './ProcurementScreen';
import { mockNavigate } from '../../../tests/__mocks__/uiMocks';

describe('ProcurementScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 5 procurement workflow cards and navigates on tap', async () => {
    const tree = await renderUi(<ProcurementScreen />);
    expect(hasText(tree, 'Vendors')).toBe(true);
    expect(hasText(tree, 'Purchase Orders')).toBe(true);
    expect(hasText(tree, 'Inventory Count')).toBe(true);
    expect(hasText(tree, 'Transfer Orders')).toBe(true);
    expect(hasText(tree, 'Vendor Returns')).toBe(true);

    await pressByText(tree, 'Purchase Orders');
    expect(mockNavigate).toHaveBeenCalledWith('PurchaseOrders');
  });
});
