import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { usePlatform } from './usePlatform';
import { useResponsive } from '../../../shared/hooks/useResponsive';
import { isElectron, getPlatformType } from '../../../shared/utils/electron';

jest.mock('../../../shared/hooks/useResponsive', () => ({
  useResponsive: jest.fn(),
}));

jest.mock('../../../shared/utils/electron', () => ({
  isElectron: jest.fn(),
  getPlatformType: jest.fn(),
}));

function mountHook() {
  let latest: ReturnType<typeof usePlatform> | null = null;
  function Harness() {
    latest = usePlatform();
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('usePlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useResponsive as jest.Mock).mockReturnValue({
      width: 1280,
      height: 800,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isWide: false,
      isTabletOrDesktop: true,
      deviceSize: 'desktop',
    });
  });

  it('combines Electron detection with responsive breakpoints', () => {
    (isElectron as jest.Mock).mockReturnValue(true);
    (getPlatformType as jest.Mock).mockReturnValue('desktop');

    const { get } = mountHook();

    expect(get().isElectron).toBe(true);
    expect(get().isDesktop).toBe(true);
    expect(get().hasWindowControls).toBe(true);
    expect(get().hasHardwareIpc).toBe(true);
    expect(get().platformType).toBe('desktop');
  });
});
