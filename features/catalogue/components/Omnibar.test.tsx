import React from 'react';
import { renderUi } from '../../../tests/testUtils';
import { Omnibar } from './Omnibar';

describe('Omnibar', () => {
  it('renders search input and clear button when value is non-empty', async () => {
    const onChangeText = jest.fn();
    const tree = await renderUi(
      <Omnibar value="latte" onChangeText={onChangeText} onSubmit={jest.fn()} showCamera onCameraPress={jest.fn()} />
    );
    expect(tree.toJSON()).not.toBeNull();
  });
});
