import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import GenericSettingsTab from './GenericSettingsTab';

const mockChangeLanguage = jest.fn();
jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({
    t: (k: string) => k,
    getCurrentLanguage: () => 'en',
    changeLanguage: mockChangeLanguage,
  }),
}));

jest.mock('../../../shared/locales/i18n', () => ({
  availableLanguages: [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
  ],
}));

describe('GenericSettingsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders language options and calls changeLanguage on tap', async () => {
    const tree = await renderUi(<GenericSettingsTab />);
    expect(hasText(tree, 'English')).toBe(true);
    expect(hasText(tree, 'Français')).toBe(true);

    await pressByText(tree, 'Français');
    expect(mockChangeLanguage).toHaveBeenCalledWith('fr');
  });
});
