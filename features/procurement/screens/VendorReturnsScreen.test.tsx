import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import VendorReturnsScreen from './VendorReturnsScreen';
import { procurementService } from '../services/ProcurementService';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'offline' } }),
}));

jest.mock('../services/VendorService', () => ({
  vendorService: {
    findAll: jest.fn().mockResolvedValue([{ id: 'v1', name: 'Bakery Supplier' }]),
  },
}));

jest.mock('../services/ProcurementService', () => ({
  procurementService: {
    findAllVendorReturns: jest.fn(),
    findAllPOs: jest.fn().mockResolvedValue([]),
    findVendorReturnItems: jest.fn(),
    createVendorReturn: jest.fn(),
    confirmVendorReturn: jest.fn(),
    cancelVendorReturn: jest.fn(),
  },
}));

describe('VendorReturnsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (procurementService.findAllVendorReturns as jest.Mock).mockResolvedValue([
      { id: 'vr-1', vendor_id: 'v1', status: 'pending', notes: 'Damaged box', created_at: 1700000000000 },
    ]);
    (procurementService.findVendorReturnItems as jest.Mock).mockResolvedValue([
      { id: 'vri-1', vendor_return_id: 'vr-1', product_name: 'Croissants', return_qty: 6, reason: 'Stale' },
    ]);
  });

  it('lists vendor returns and opens detail view with Confirm Return button', async () => {
    const tree = await renderUi(<VendorReturnsScreen />);
    expect(hasText(tree, 'Bakery Supplier')).toBe(true);

    await pressByText(tree, 'Bakery Supplier');
    expect(hasText(tree, 'Return Details')).toBe(true);
    expect(hasText(tree, 'Croissants')).toBe(true);
    expect(hasText(tree, 'Confirm Return')).toBe(true);
  });
});
