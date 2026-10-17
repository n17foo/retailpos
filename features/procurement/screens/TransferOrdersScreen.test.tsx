import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import TransferOrdersScreen from './TransferOrdersScreen';
import { procurementService } from '../services/ProcurementService';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'offline' } }),
}));

jest.mock('../../catalogue/hooks/useProducts', () => ({
  useProductsForDisplay: () => ({ products: [{ id: 'p1', name: 'Paper Cups' }] }),
}));

jest.mock('../services/ProcurementService', () => ({
  procurementService: {
    findAllTransferOrders: jest.fn(),
    findTransferOrderItems: jest.fn(),
    createTransferOrder: jest.fn(),
    dispatchTransferOrder: jest.fn(),
    receiveTransferOrder: jest.fn(),
    cancelTransferOrder: jest.fn(),
  },
}));

describe('TransferOrdersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (procurementService.findAllTransferOrders as jest.Mock).mockResolvedValue([
      { id: 'tr-1', from_location: 'Warehouse', to_location: 'High St', status: 'draft', notes: 'Urgent', created_at: 1700000000000 },
    ]);
    (procurementService.findTransferOrderItems as jest.Mock).mockResolvedValue([
      { id: 'ti-1', transfer_order_id: 'tr-1', product_name: 'Paper Cups', transfer_qty: 50 },
    ]);
  });

  it('lists transfer orders and opens detail view with Dispatch action', async () => {
    const tree = await renderUi(<TransferOrdersScreen />);
    expect(hasText(tree, 'Warehouse → High St')).toBe(true);

    await pressByText(tree, 'Warehouse → High St');
    expect(hasText(tree, 'Transfer Details')).toBe(true);
    expect(hasText(tree, 'Paper Cups')).toBe(true);
    expect(hasText(tree, 'Dispatch')).toBe(true);
  });
});
