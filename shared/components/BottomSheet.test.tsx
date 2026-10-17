import React from 'react';
import { renderUi, hasText } from '../../tests/testUtils';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

describe('BottomSheet', () => {
  it('renders title and body when visible', async () => {
    const onClose = jest.fn();
    const tree = await renderUi(
      <BottomSheet visible title="Basket Sheet" onClose={onClose}>
        <Button title="Checkout" />
      </BottomSheet>
    );
    expect(hasText(tree, 'Basket Sheet')).toBe(true);
    expect(hasText(tree, 'Checkout')).toBe(true);
  });
});
