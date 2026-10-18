import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { SettingsHeader } from './SettingsHeader';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../shared/contexts/ThemeProvider', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../shared/utils/theme').lightColors }),
}));

describe('SettingsHeader', () => {
  it('renders the settings title', async () => {
    const tree = await renderUi(<SettingsHeader showBackButton={false} onGoBack={jest.fn()} />);
    expect(hasText(tree, 'settings.title')).toBe(true);
  });

  it('shows the back button only when requested and fires onGoBack', async () => {
    const onGoBack = jest.fn();
    const tree = await renderUi(<SettingsHeader showBackButton onGoBack={onGoBack} />);
    await pressByText(tree, 'settings.backButton');
    expect(onGoBack).toHaveBeenCalledTimes(1);

    const noBack = await renderUi(<SettingsHeader showBackButton={false} onGoBack={jest.fn()} />);
    expect(hasText(noBack, 'settings.backButton')).toBe(false);
  });
});
