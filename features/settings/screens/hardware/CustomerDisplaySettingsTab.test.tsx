import React from 'react';
import { renderUi, hasText } from '../../../../tests/testUtils';
import { CustomerDisplaySettingsTab } from './CustomerDisplaySettingsTab';

jest.mock('../../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textSecondary: '#666',
    },
  }),
}));

describe('CustomerDisplaySettingsTab', () => {
  it('renders Customer-Facing Display card', async () => {
    const tree = await renderUi(<CustomerDisplaySettingsTab />);
    expect(hasText(tree, 'Customer-Facing Display')).toBe(true);
  });
});
