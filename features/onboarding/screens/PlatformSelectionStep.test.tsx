import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PlatformSelectionStep from './PlatformSelectionStep';

jest.mock('../../../shared/hooks/useResponsive', () => ({
  useResponsive: () => ({ isTabletOrDesktop: true }),
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('PlatformSelectionStep', () => {
  it('renders all 9 platform cards and invokes onSelectPlatform when tapped', async () => {
    const onSelectPlatform = jest.fn();
    const tree = await renderUi(<PlatformSelectionStep onSelectPlatform={onSelectPlatform} />);
    expect(hasText(tree, 'Shopify')).toBe(true);
    expect(hasText(tree, 'Offline Mode')).toBe(true);

    await pressByText(tree, 'Shopify');
    expect(onSelectPlatform).toHaveBeenCalledWith('shopify');
  });
});
