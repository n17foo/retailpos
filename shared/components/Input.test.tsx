import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import { Input } from './Input';

describe('Input', () => {
  it('renders label, required asterisk, error message, and clears value on clear press', async () => {
    const onChangeText = jest.fn();
    const onClear = jest.fn();
    const tree = await renderUi(
      <Input
        label="Store URL"
        required
        value="shop.example.com"
        error="Invalid URL"
        showClearButton
        onChangeText={onChangeText}
        onClear={onClear}
      />
    );
    expect(hasText(tree, 'Store URL')).toBe(true);
    expect(hasText(tree, 'Invalid URL')).toBe(true);
    await pressByText(tree, '✕');
    expect(onChangeText).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
