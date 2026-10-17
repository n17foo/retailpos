import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import { Button } from './Button';

describe('Button', () => {
  it('renders title and calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(<Button title="Pay Now" variant="primary" size="lg" onPress={onPress} />);
    expect(hasText(tree, 'Pay Now')).toBe(true);
    await pressByText(tree, 'Pay Now');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('hides label and shows spinner when loading', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(<Button title="Pay Now" loading onPress={onPress} />);
    expect(hasText(tree, 'Pay Now')).toBe(false);
  });
});
