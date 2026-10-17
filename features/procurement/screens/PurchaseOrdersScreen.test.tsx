import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PurchaseOrdersScreen from './PurchaseOrdersScreen';
import { procurementService } from '../services/ProcurementService';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'offline' } }),
}));

jest.mock('../services/VendorService', () => ({
  vendorService: {
    findAll: jest.fn().mockResolvedValue([{ id: 'v1', name: 'Roasters Ltd' }]),
  },
}));

jest.mock('../services/ProcurementService', () => ({
  procurementService: {
    findAllPOs: jest.fn(),
    findPOItems: jest.fn(),
    submitPO: jest.fn(),
    cancelPO: jest.fn(),
    receivePO: jest.fn(),
  },
}));

describe('PurchaseOrdersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (procurementService.findAllPOs as jest.Mock).mockResolvedValue([
      { id: 'po-12345678', vendor_id: 'v1', status: 'ordered', expected_date: null, created_at: 1000 },
    ]);
    (procurementService.findPOItems as jest.Mock).mockResolvedValue([
      { id: 'item-1', po_id: 'po-12345678', product_name: 'Espresso Beans', ordered_qty: 10, received_qty: 2, unit_cost: 8 },
    ]);
  });

  it('lists purchase orders, opens detail view, and navigates to Receive Goods view', async () => {
    const tree = await renderUi(<PurchaseOrdersScreen />);
    expect(hasText(tree, 'PO #12345678')).toBe(true);
    expect(hasText(tree, 'Roasters Ltd')).toBe(true);

    await pressByText(tree, 'PO #12345678');
    expect(hasText(tree, 'Espresso Beans')).toBe(true);

    await pressByText(tree, 'Receive Goods');
    expect(hasText(tree, 'Confirm Receipt')).toBe(true);
  });
});
