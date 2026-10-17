import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { CategoryButton } from './CategoryButton';

describe('CategoryButton', () => {
  it('renders label, child indicator, and handles onPress', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(<CategoryButton label="Drinks" hasChildren selected onPress={onPress} />);
    expect(hasText(tree, 'Drinks ›')).toBe(true);
    await pressByText(tree, 'Drinks');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
