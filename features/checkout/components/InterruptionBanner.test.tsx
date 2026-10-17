import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { InterruptionBanner } from './InterruptionBanner';

describe('InterruptionBanner', () => {
  it('returns null when type is none and renders message + action buttons when active', async () => {
    const noneTree = await renderUi(<InterruptionBanner type="none" message="" actions={[]} />);
    expect(noneTree.toJSON()).toBeNull();

    const onResume = jest.fn();
    const tree = await renderUi(
      <InterruptionBanner
        type="interrupted-checkout"
        message="Checkout was interrupted"
        actions={[{ label: 'Resume Checkout', onPress: onResume, variant: 'primary' }]}
      />
    );
    expect(hasText(tree, 'Checkout was interrupted')).toBe(true);
    await pressByText(tree, 'Resume Checkout');
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
