import React from 'react';
import { renderUi, hasText } from '../../tests/testUtils';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders label for status variants', async () => {
    const tree = await renderUi(<StatusBadge status="success" label="Synced" size="md" />);
    expect(hasText(tree, 'Synced')).toBe(true);
  });
});
