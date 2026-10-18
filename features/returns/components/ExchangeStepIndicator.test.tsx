import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { ExchangeStepIndicator } from './ExchangeStepIndicator';

describe('ExchangeStepIndicator', () => {
  it('renders the three step labels and numbers', async () => {
    const tree = await renderUi(<ExchangeStepIndicator step="select_returns" />);
    expect(hasText(tree, 'Returns')).toBe(true);
    expect(hasText(tree, 'New Items')).toBe(true);
    expect(hasText(tree, 'Settle')).toBe(true);
    expect(hasText(tree, '1')).toBe(true);
    expect(hasText(tree, '2')).toBe(true);
    expect(hasText(tree, '3')).toBe(true);
  });
});
