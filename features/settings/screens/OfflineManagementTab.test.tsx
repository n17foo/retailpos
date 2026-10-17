import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import OfflineManagementTab from './OfflineManagementTab';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', role: 'admin' } }),
}));

jest.mock('./ProductManagementTab', () => {
  const R = require('react');
  return () => R.createElement('Text', null, 'MockProductManagementTab');
});

describe('OfflineManagementTab', () => {
  it('renders overview cards and navigates to ProductManagementTab on tap', async () => {
    const tree = await renderUi(<OfflineManagementTab />);
    expect(hasText(tree, 'settings.offline.products')).toBe(true);
    expect(hasText(tree, 'settings.offline.categories')).toBe(true);

    await pressByText(tree, 'settings.offline.products');
    expect(hasText(tree, 'MockProductManagementTab')).toBe(true);
  });
});
