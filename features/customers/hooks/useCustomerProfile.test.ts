import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useCustomerProfile } from './useCustomerProfile';
import { localCustomerService } from '../services/customer/LocalCustomerService';
import { loyaltyService } from '../services/loyalty/LoyaltyService';
import { storeCreditService } from '../services/customer/StoreCreditService';

jest.mock('../services/customer/LocalCustomerService', () => ({
  localCustomerService: {
    findByEmail: jest.fn(),
    getOrderHistory: jest.fn(),
  },
}));

jest.mock('../services/loyalty/LoyaltyService', () => ({
  loyaltyService: {
    getBalance: jest.fn(),
  },
}));

jest.mock('../services/customer/StoreCreditService', () => ({
  storeCreditService: {
    getBalanceDollars: jest.fn(),
  },
}));

async function mountHook(email: string | null) {
  let latest: ReturnType<typeof useCustomerProfile> | null = null;
  function Harness({ e }: { e: string | null }) {
    latest = useCustomerProfile(e);
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness, { e: email }));
  });
  return { get: () => latest! };
}

describe('useCustomerProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch when email is null', async () => {
    const { get } = await mountHook(null);
    expect(localCustomerService.findByEmail).not.toHaveBeenCalled();
    expect(get().customer).toBeNull();
    expect(get().isLoading).toBe(false);
  });

  it('loads customer, order history, loyalty balance, and store credit on mount', async () => {
    (localCustomerService.findByEmail as jest.Mock).mockResolvedValue({ email: 'a@b.com', name: 'Alice' });
    (localCustomerService.getOrderHistory as jest.Mock).mockResolvedValue([{ id: 'o1', total: 25 }]);
    (loyaltyService.getBalance as jest.Mock).mockResolvedValue({ points: 100, dollarValue: 5 });
    (storeCreditService.getBalanceDollars as jest.Mock).mockResolvedValue(12.5);

    const { get } = await mountHook('a@b.com');

    expect(get().customer).toEqual({ email: 'a@b.com', name: 'Alice' });
    expect(get().orderHistory).toEqual([{ id: 'o1', total: 25 }]);
    expect(get().loyaltyBalance).toEqual({ points: 100, dollarValue: 5 });
    expect(get().storeCreditDollars).toBe(12.5);
    expect(get().error).toBeNull();
  });

  it('sets error when loading fails', async () => {
    (localCustomerService.findByEmail as jest.Mock).mockRejectedValue(new Error('DB error'));

    const { get } = await mountHook('a@b.com');

    expect(get().error).toBe('DB error');
    expect(get().isLoading).toBe(false);
  });
});
