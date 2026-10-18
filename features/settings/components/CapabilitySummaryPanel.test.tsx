import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { CapabilitySummaryPanel } from './CapabilitySummaryPanel';

describe('CapabilitySummaryPanel', () => {
  it('renders the title, platform name and capability rows', async () => {
    const tree = await renderUi(<CapabilitySummaryPanel platform="shopify" />);
    expect(hasText(tree, 'Platform capability summary')).toBe(true);
    expect(hasText(tree, 'Shopify')).toBe(true);
    expect(hasText(tree, 'Basket / checkout mode')).toBe(true);
    expect(hasText(tree, 'Catalog & variants')).toBe(true);
    expect(hasText(tree, 'Order sync')).toBe(true);
  });

  it('renders for the offline platform', async () => {
    const tree = await renderUi(<CapabilitySummaryPanel platform="offline" />);
    expect(hasText(tree, 'Platform capability summary')).toBe(true);
    expect(hasText(tree, 'Local only')).toBe(true);
  });
});
