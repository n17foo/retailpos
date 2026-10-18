import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { SettingsTabDropdown } from './SettingsTabDropdown';
import type { ComposedSettingsTab } from '../services/SettingsTabComposer';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../shared/utils/theme').lightColors }),
}));

const tabs: ComposedSettingsTab[] = [
  { key: 'generic', translationKey: 'settings.tabs.general', icon: '⚙️', status: 'enabled' },
  { key: 'payment', translationKey: 'settings.tabs.payment', icon: '💳', status: 'enabled' },
];

describe('SettingsTabDropdown', () => {
  it('shows the active tab label and icon', async () => {
    const tree = await renderUi(
      <SettingsTabDropdown
        tabs={tabs}
        activeTab="generic"
        activeTabIcon="⚙️"
        activeTabLabel="settings.tabs.general"
        onSelectTab={jest.fn()}
      />
    );
    expect(hasText(tree, 'settings.tabs.general')).toBe(true);
    expect(hasText(tree, '⚙️')).toBe(true);
  });

  it('opens the modal and selects a tab', async () => {
    const onSelectTab = jest.fn();
    const tree = await renderUi(
      <SettingsTabDropdown
        tabs={tabs}
        activeTab="generic"
        activeTabIcon="⚙️"
        activeTabLabel="settings.tabs.general"
        onSelectTab={onSelectTab}
      />
    );
    await pressByText(tree, '▾');
    await pressByText(tree, 'settings.tabs.payment');
    expect(onSelectTab).toHaveBeenCalledWith('payment');
  });
});
