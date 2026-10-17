import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import CustomerProfileScreen from './CustomerProfileScreen';

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const mockReload = jest.fn();
jest.mock('../hooks/useCustomerProfile', () => ({
  useCustomerProfile: () => ({
    customer: {
      id: 'c1',
      email: 'alice@example.com',
      name: 'Alice Smith',
      phone: '07700900000',
      segment: 'VIP',
      notes: 'Prefers oat milk',
      totalOrders: 3,
      totalSpend: 45,
    },
    orderHistory: [
      {
        orderId: 'order-12345678',
        total: 15,
        status: 'paid',
        createdAt: 1700000000000,
        items: [{ name: 'Latte', quantity: 2 }],
      },
    ],
    loyaltyBalance: { points: 150, valueInCents: 750, tier: 'Gold' },
    storeCreditDollars: 10,
    isLoading: false,
    error: null,
    reload: mockReload,
  }),
}));

jest.mock('../services/customer/LocalCustomerService', () => ({
  localCustomerService: { update: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../services/loyalty/LoyaltyService', () => ({
  loyaltyService: { adjustPoints: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../services/customer/StoreCreditService', () => ({
  storeCreditService: { issue: jest.fn().mockResolvedValue(undefined) },
}));

describe('CustomerProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders customer details, loyalty points, store credit, order history, and opens edit form', async () => {
    const tree = await renderUi(<CustomerProfileScreen />);
    expect(hasText(tree, 'Alice Smith')).toBe(true);
    expect(hasText(tree, '150 pts')).toBe(true);
    expect(hasText(tree, 'Tier: Gold')).toBe(true);
    expect(hasText(tree, 'Latte ×2')).toBe(true);

    await pressByText(tree, 'Edit profile');
    expect(hasText(tree, 'Save')).toBe(true);
  });
});
