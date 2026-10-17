import React from 'react';
import { renderUi, pressByText } from '../../../tests/testUtils';
import PinKeypad from './PinKeypad';

describe('PinKeypad', () => {
  it('calls onKeyPress for digits/biometric and onDeletePress for backspace', async () => {
    const onKeyPress = jest.fn();
    const onDeletePress = jest.fn();
    const tree = await renderUi(<PinKeypad onKeyPress={onKeyPress} onDeletePress={onDeletePress} />);

    await pressByText(tree, '5');
    expect(onKeyPress).toHaveBeenCalledWith('5');

    await pressByText(tree, '👆');
    expect(onKeyPress).toHaveBeenCalledWith('biometric');

    await pressByText(tree, '⌫');
    expect(onDeletePress).toHaveBeenCalledTimes(1);
  });
});
