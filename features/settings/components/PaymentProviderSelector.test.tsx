import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PaymentProviderSelector } from './PaymentProviderSelector';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('PaymentProviderSelector', () => {
  it('renders the provider label and all provider options', async () => {
    const tree = await renderUi(<PaymentProviderSelector selected={PaymentProvider.STRIPE_NFC} isLoading={false} onSelect={jest.fn()} />);
    expect(hasText(tree, 'settings.payment.provider')).toBe(true);
    expect(hasText(tree, 'Stripe NFC (Tap to Pay)')).toBe(true);
    expect(hasText(tree, 'Square')).toBe(true);
    expect(hasText(tree, 'Instore PED')).toBe(true);
  });

  it('fires onSelect with the pressed provider', async () => {
    const onSelect = jest.fn();
    const tree = await renderUi(<PaymentProviderSelector selected={PaymentProvider.STRIPE_NFC} isLoading={false} onSelect={onSelect} />);
    await pressByText(tree, 'Adyen');
    expect(onSelect).toHaveBeenCalledWith(PaymentProvider.ADYEN);
  });
});
