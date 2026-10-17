import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useLoyaltyBasket } from './useLoyaltyBasket';
import { loyaltyService } from '../../customers/services/loyalty/LoyaltyService';
import { storeCreditService } from '../../customers/services/customer/StoreCreditService';

jest.mock('../../customers/services/loyalty/LoyaltyService', () => ({
  loyaltyService: {
    getBalance: jest.fn(),
    redeemPoints: jest.fn(),
    reverseRedemption: jest.fn(),
  },
}));

jest.mock('../../customers/services/customer/StoreCreditService', () => ({
  storeCreditService: {
    getBalanceDollars: jest.fn(),
    redeem: jest.fn(),
    reverseRedemption: jest.fn(),
  },
}));

function mountHook(customerEmail?: string, orderId?: string) {
  let latest: ReturnType<typeof useLoyaltyBasket> | null = null;
  function Harness() {
    latest = useLoyaltyBasket(customerEmail, orderId);
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useLoyaltyBasket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loyaltyService.getBalance as jest.Mock).mockResolvedValue({ points: 200, dollarValue: 10 });
    (storeCreditService.getBalanceDollars as jest.Mock).mockResolvedValue(25);
  });

  it('loads loyalty and store credit balances when customer is present', async () => {
    const { get } = mountHook('c@example.com', 'ord-1');

    await act(async () => {
      await get().loadBalances();
    });

    expect(get().loyaltyBalance).toEqual({ points: 200, dollarValue: 10 });
    expect(get().storeCreditDollars).toBe(25);
  });

  it('redeems loyalty points and reverses active redemption', async () => {
    (loyaltyService.redeemPoints as jest.Mock).mockResolvedValue({ transactionId: 'tx-l1', discountDollars: 5 });

    const { get } = mountHook('c@example.com', 'ord-1');

    let discount = 0;
    await act(async () => {
      discount = await get().redeemLoyalty(100);
    });

    expect(discount).toBe(5);
    expect(get().activeRedemption).toEqual({ type: 'loyalty', transactionId: 'tx-l1', discountDollars: 5 });

    await act(async () => {
      await get().reverseActiveRedemption();
    });

    expect(loyaltyService.reverseRedemption).toHaveBeenCalledWith('tx-l1');
    expect(get().activeRedemption).toBeNull();
  });
});
