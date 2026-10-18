import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { CheckoutModalHeader } from './CheckoutModalHeader';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('CheckoutModalHeader', () => {
  it('renders the title and fires onClose from the close button', async () => {
    const onClose = jest.fn();
    const tree = await renderUi(<CheckoutModalHeader title="Split Payment" onClose={onClose} />);
    expect(hasText(tree, 'Split Payment')).toBe(true);
    await pressByText(tree, '✕');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a back button when onBack is provided', async () => {
    const onBack = jest.fn();
    const tree = await renderUi(<CheckoutModalHeader title="Cash" onClose={jest.fn()} onBack={onBack} />);
    expect(hasText(tree, '←')).toBe(true);
    await pressByText(tree, '←');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders no back button without onBack', async () => {
    const tree = await renderUi(<CheckoutModalHeader title="Cash" onClose={jest.fn()} />);
    expect(hasText(tree, '←')).toBe(false);
  });
});
