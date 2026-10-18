import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { SettingsTabBar } from './SettingsTabBar';
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
  { key: 'ecommerce', translationKey: 'settings.tabs.ecommerce', icon: '🌐', status: 'disabled' },
];

describe('SettingsTabBar', () => {
  it('renders tabs and selects an enabled tab', async () => {
    const onSelectTab = jest.fn();
    const tree = await renderUi(<SettingsTabBar tabs={tabs} activeTab="generic" onSelectTab={onSelectTab} />);
    expect(hasText(tree, 'settings.tabs.payment')).toBe(true);
    await pressByText(tree, 'settings.tabs.payment');
    expect(onSelectTab).toHaveBeenCalledWith('payment');
  });

  it('ignores presses on disabled tabs', async () => {
    const onSelectTab = jest.fn();
    const tree = await renderUi(<SettingsTabBar tabs={tabs} activeTab="generic" onSelectTab={onSelectTab} />);
    await pressByText(tree, 'settings.tabs.ecommerce');
    expect(onSelectTab).not.toHaveBeenCalled();
  });
});
