import React from 'react';
import { renderUi } from '../../../tests/testUtils';
import PinDisplay from './PinDisplay';

describe('PinDisplay', () => {
  it('renders the specified number of PIN dots', async () => {
    const tree = await renderUi(<PinDisplay pinLength={6} filledCount={3} />);
    const views = tree.root.findAllByType('View' as never);
    // 1 container View + 6 dot Views
    expect(views).toHaveLength(7);
  });
});
