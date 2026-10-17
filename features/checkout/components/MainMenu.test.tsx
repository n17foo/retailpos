import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { MainMenu } from './MainMenu';

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({ ecommerceSettings: { platform: 'shopify' } }),
}));

describe('MainMenu', () => {
  it('renders quick actions, role-gated items, and Lock/Log out buttons', async () => {
    const onLock = jest.fn();
    const onLogout = jest.fn();
    const onReprint = jest.fn();

    const tree = await renderUi(
      <MainMenu
        visible
        onClose={jest.fn()}
        userRole="admin"
        onLock={onLock}
        onLogout={onLogout}
        onReprintReceipt={onReprint}
        unsyncedCount={2}
        onSyncPress={jest.fn()}
      />
    );
    expect(hasText(tree, 'Reprint last receipt')).toBe(true);
    expect(hasText(tree, 'Inventory')).toBe(true);

    await pressByText(tree, 'Lock register');
    expect(onLock).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Log out');
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
