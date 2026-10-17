import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { CheckoutModal } from './CheckoutModal';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

describe('CheckoutModal', () => {
  it('opens directly into cash_tender step when initialTender is cash and confirms exact tender', async () => {
    const onSelectPayment = jest.fn();
    const tree = await renderUi(
      <CheckoutModal
        visible
        orderId="ord-12345678"
        orderTotal={12.5}
        orderSubtotal={10.42}
        orderTax={2.08}
        itemCount={2}
        initialTender="cash"
        onSelectPayment={onSelectPayment}
        onCancel={jest.fn()}
      />
    );
    expect(hasText(tree, '£12.50')).toBe(true);

    await pressByText(tree, 'checkout.exact');
    await pressByText(tree, 'checkout.confirmCash');
    expect(onSelectPayment).toHaveBeenCalledWith({ method: 'cash', tenderedAmount: 12.5 });
  });

  it('computes cent-accurate remaining balance in splitMode', async () => {
    const onCompleteSplit = jest.fn();
    const tree = await renderUi(
      <CheckoutModal
        visible
        orderId="ord-12345678"
        orderTotal={29.97}
        orderSubtotal={24.98}
        orderTax={4.99}
        itemCount={3}
        splitMode
        paymentLines={[
          { id: 'pl-1', method: 'cash', amount: 9.99, processedAt: 1700000000000 },
          { id: 'pl-2', method: 'card', amount: 19.98, processedAt: 1700000000000 },
        ]}
        onCompleteSplit={onCompleteSplit}
        onSelectPayment={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(hasText(tree, 'Complete Sale')).toBe(true);
    await pressByText(tree, 'Complete Sale');
    expect(onCompleteSplit).toHaveBeenCalledTimes(1);
  });
});
