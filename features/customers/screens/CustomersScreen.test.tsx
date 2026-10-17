import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import CustomersScreen from './CustomersScreen';
import { localCustomerService } from '../services/customer/LocalCustomerService';
import { mockNavigate } from '../../../tests/__mocks__/uiMocks';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../services/customer/LocalCustomerService', () => ({
  localCustomerService: {
    findAll: jest.fn(),
  },
}));

describe('CustomersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (localCustomerService.findAll as jest.Mock).mockResolvedValue([
      {
        id: 'c1',
        email: 'alice@example.com',
        name: 'Alice Smith',
        phone: '07700900000',
        segment: 'VIP',
        totalOrders: 4,
        totalSpend: 120.5,
      },
    ]);
  });

  it('loads and displays customer list and navigates to CustomerProfile on tap', async () => {
    const tree = await renderUi(<CustomersScreen />);
    expect(hasText(tree, 'Alice Smith')).toBe(true);
    expect(hasText(tree, 'VIP')).toBe(true);

    await pressByText(tree, 'Alice Smith');
    expect(mockNavigate).toHaveBeenCalledWith('CustomerProfile', { email: 'alice@example.com' });
  });
});
