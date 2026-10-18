import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { SettingsSideNav } from './SettingsSideNav';
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
  { key: 'ecommerce', translationKey: 'settings.tabs.ecommerce', icon: '🌐', status: 'disabled', reason: 'Offline mode' },
];

describe('SettingsSideNav', () => {
  it('renders tab labels and fires onSelectTab for enabled tabs', async () => {
    const onSelectTab = jest.fn();
    const tree = await renderUi(<SettingsSideNav tabs={tabs} activeTab="generic" onSelectTab={onSelectTab} />);
    expect(hasText(tree, 'settings.tabs.general')).toBe(true);
    await pressByText(tree, 'settings.tabs.payment');
    expect(onSelectTab).toHaveBeenCalledWith('payment');
  });

  it('does not fire onSelectTab for disabled tabs and shows the reason', async () => {
    const onSelectTab = jest.fn();
    const tree = await renderUi(<SettingsSideNav tabs={tabs} activeTab="generic" onSelectTab={onSelectTab} />);
    expect(hasText(tree, 'Offline mode')).toBe(true);
    await pressByText(tree, 'settings.tabs.ecommerce');
    expect(onSelectTab).not.toHaveBeenCalled();
  });
});
