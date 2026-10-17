import React from 'react';
import { renderUi } from '../../tests/testUtils';
import { MainTabNavigator } from './MainTabNavigator';

jest.mock('../../features/checkout/screens/SaleScreen', () => () => {
  const R = require('react');
  return R.createElement('Text', null, 'MockSaleScreen');
});

jest.mock('./MoreNavigator', () => ({
  MoreNavigator: () => {
    const R = require('react');
    return R.createElement('Text', null, 'MockMoreNavigator');
  },
}));

describe('MainTabNavigator', () => {
  it('hides Inventory tab for cashiers and shows it for managers', async () => {
    const cashierTree = await renderUi(<MainTabNavigator username="Cashier" userRole="cashier" onLock={jest.fn()} onLogout={jest.fn()} />);
    const cashierScreens = cashierTree.root.findAllByType('Screen' as never).map(s => s.props.name);
    expect(cashierScreens).toEqual(['Sale', 'More']);

    const managerTree = await renderUi(<MainTabNavigator username="Manager" userRole="manager" onLock={jest.fn()} onLogout={jest.fn()} />);
    const managerScreens = managerTree.root.findAllByType('Screen' as never).map(s => s.props.name);
    expect(managerScreens).toEqual(['Sale', 'Inventory', 'More']);
  });
});
