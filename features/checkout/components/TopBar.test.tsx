import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { TopBar } from './TopBar';

describe('TopBar', () => {
  it('renders register/cashier identity, sync badge, drawer warning, sale state chip, and mode chip', async () => {
    const onCycleSaleMode = jest.fn();
    const tree = await renderUi(
      <TopBar
        registerName="Till 1"
        cashierName="Alice"
        saleState="building"
        unsyncedCount={2}
        isDrawerOpen
        onMenuPress={jest.fn()}
        height={48}
        searchQuery=""
        onSearchChange={jest.fn()}
        onSearchSubmit={jest.fn()}
        saleModes={['counter', 'pickup']}
        saleMode="counter"
        onCycleSaleMode={onCycleSaleMode}
      />
    );
    expect(hasText(tree, 'Till 1')).toBe(true);
    expect(hasText(tree, 'Alice')).toBe(true);
    expect(hasText(tree, '2')).toBe(true);
    expect(hasText(tree, 'Drawer')).toBe(true);
    expect(hasText(tree, 'counter')).toBe(true);

    await pressByText(tree, 'counter');
    expect(onCycleSaleMode).toHaveBeenCalledTimes(1);
  });
});
