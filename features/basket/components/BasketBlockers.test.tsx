import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BasketBlockers } from './BasketBlockers';

describe('BasketBlockers', () => {
  it('returns null when empty and renders blocker issues and action buttons', async () => {
    const emptyTree = await renderUi(<BasketBlockers blockers={[]} />);
    expect(emptyTree.toJSON()).toBeNull();

    const onAction = jest.fn();
    const tree = await renderUi(
      <BasketBlockers
        blockers={[
          {
            type: 'warning',
            code: 'customer-required',
            message: 'Customer email required for discount',
            action: { label: 'Add Customer', onPress: onAction },
          },
        ]}
      />
    );
    expect(hasText(tree, '1 ISSUE TO RESOLVE')).toBe(true);
    expect(hasText(tree, 'Customer email required for discount')).toBe(true);

    await pressByText(tree, 'Add Customer');
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
