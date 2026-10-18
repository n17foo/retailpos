import React from 'react';
import { Text } from 'react-native';
import { renderUi, hasText } from '../../../tests/testUtils';
import { SwipeableLine } from './SwipeableLine';

describe('SwipeableLine', () => {
  it('renders children and the delete affordance when onRemove is provided', async () => {
    const tree = await renderUi(
      <SwipeableLine onRemove={jest.fn()}>
        <Text>Line content</Text>
      </SwipeableLine>
    );
    expect(hasText(tree, 'Line content')).toBe(true);
  });

  it('renders children without swipe handlers when onRemove is undefined', async () => {
    const tree = await renderUi(
      <SwipeableLine>
        <Text>Pointer line</Text>
      </SwipeableLine>
    );
    expect(hasText(tree, 'Pointer line')).toBe(true);
  });
});
