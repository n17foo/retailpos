import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import VendorsScreen from './VendorsScreen';
import { vendorService } from '../services/VendorService';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../services/VendorService', () => ({
  vendorService: {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  },
}));

describe('VendorsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (vendorService.findAll as jest.Mock).mockResolvedValue([
      { id: 'v1', name: 'Bean Suppliers', contact_name: 'Sam', email: 'sam@beans.com', phone: '0123456', address: null, notes: null },
    ]);
  });

  it('renders vendor list and opens New Vendor form on + Add', async () => {
    const tree = await renderUi(<VendorsScreen />);
    expect(hasText(tree, 'Bean Suppliers')).toBe(true);
    expect(hasText(tree, 'sam@beans.com')).toBe(true);

    await pressByText(tree, '+ Add');
    expect(hasText(tree, 'New Vendor')).toBe(true);
  });
});
