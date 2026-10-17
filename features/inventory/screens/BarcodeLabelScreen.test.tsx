import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import BarcodeLabelScreen from './BarcodeLabelScreen';
import { barcodeLabelService } from '../services/BarcodeLabelService';

const mockProducts = [{ id: 'p1', name: 'Matcha Tin', sku: 'MT-01', price: 12.5 }];

jest.mock('../../catalogue/hooks/useProducts', () => ({
  useProductsForDisplay: () => ({
    products: mockProducts,
  }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../services/BarcodeLabelService', () => ({
  barcodeLabelService: {
    getDefaultFormat: () => ({
      width: 50,
      height: 30,
      fontSize: 'medium',
      includePrice: true,
      includeName: true,
      includeSku: true,
    }),
    validateLabelData: () => ({ valid: true, errors: [] }),
    printLabels: jest.fn().mockResolvedValue({ success: true, printed: 1, failed: 0 }),
    exportToCsv: jest.fn().mockResolvedValue('name,sku\nMatcha Tin,MT-01'),
  },
}));

describe('BarcodeLabelScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects products with configured currency formatting and prints barcode labels', async () => {
    const tree = await renderUi(<BarcodeLabelScreen />);
    expect(hasText(tree, 'Matcha Tin')).toBe(true);
    expect(hasText(tree, '£12.50')).toBe(true);

    await pressByText(tree, 'Select All');
    expect(hasText(tree, 'Print 1 Labels')).toBe(true);

    await pressByText(tree, 'Print 1 Labels');
    expect(barcodeLabelService.printLabels).toHaveBeenCalled();
  });
});
