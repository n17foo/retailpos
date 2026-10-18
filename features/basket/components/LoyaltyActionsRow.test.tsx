import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { LoyaltyActionsRow } from './LoyaltyActionsRow';

const baseProps = {
  loyaltyBalance: null,
  storeCreditDollars: 0,
  activeRedemption: null,
  isRedemptionLoading: false,
  currencyCode: 'GBP',
  onRedeemLoyalty: jest.fn(),
  onRedeemStoreCredit: jest.fn(),
  onReverseRedemption: jest.fn(),
};

describe('LoyaltyActionsRow', () => {
  it('renders nothing actionable when there are no balances', async () => {
    const tree = await renderUi(<LoyaltyActionsRow {...baseProps} />);
    expect(hasText(tree, 'Redeem')).toBe(false);
    expect(hasText(tree, 'store credit')).toBe(false);
  });

  it('renders redeem buttons for loyalty points and store credit', async () => {
    const onRedeemLoyalty = jest.fn();
    const onRedeemStoreCredit = jest.fn();
    const tree = await renderUi(
      <LoyaltyActionsRow
        {...baseProps}
        loyaltyBalance={{ points: 200, valueInCents: 1000, tier: 'standard', lifetimeEarned: 200 }}
        storeCreditDollars={5}
        onRedeemLoyalty={onRedeemLoyalty}
        onRedeemStoreCredit={onRedeemStoreCredit}
      />
    );
    expect(hasText(tree, 'Redeem 200 pts')).toBe(true);
    await pressByText(tree, 'Redeem 200 pts');
    expect(onRedeemLoyalty).toHaveBeenCalledWith(200);
    await pressByText(tree, 'store credit');
    expect(onRedeemStoreCredit).toHaveBeenCalledWith(5);
  });

  it('shows the reversal control for an active redemption', async () => {
    const onReverseRedemption = jest.fn();
    const tree = await renderUi(
      <LoyaltyActionsRow
        {...baseProps}
        activeRedemption={{ type: 'loyalty', transactionId: 'tx-1', discountDollars: 10 }}
        onReverseRedemption={onReverseRedemption}
      />
    );
    expect(hasText(tree, 'Points applied')).toBe(true);
    await pressByText(tree, 'Undo');
    expect(onReverseRedemption).toHaveBeenCalledTimes(1);
  });
});
