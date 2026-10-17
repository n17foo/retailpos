import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useSettings } from './useSettings';

const mockGetAllKeys = jest.fn();
const mockGetItem = jest.fn();
const mockSetObject = jest.fn();

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  KeyValueRepository: jest.fn().mockImplementation(() => ({
    getAllKeys: (...args: unknown[]) => mockGetAllKeys(...args),
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setObject: (...args: unknown[]) => mockSetObject(...args),
  })),
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

async function mountHook() {
  let latest: ReturnType<typeof useSettings> | null = null;
  function Harness() {
    latest = useSettings();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllKeys.mockResolvedValue(['theme.preset', 'pos.taxRate']);
    mockGetItem.mockImplementation(async (key: string) => (key === 'theme.preset' ? 'dark' : '0.2'));
    mockSetObject.mockResolvedValue(undefined);
  });

  it('loads all settings on mount and resolves getSetting with fallback', async () => {
    const { get } = await mountHook();

    expect(get().isLoading).toBe(false);
    expect(get().getSetting('theme.preset', 'light')).toBe('dark');
    expect(get().getSetting('missing.key', 'fallback')).toBe('fallback');
  });

  it('optimistically updates setting and persists via KeyValueRepository', async () => {
    const { get } = await mountHook();

    await act(async () => {
      await get().updateSetting('theme.preset', 'high-contrast');
    });

    expect(mockSetObject).toHaveBeenCalledWith('theme.preset', 'high-contrast');
    expect(get().getSetting('theme.preset', 'light')).toBe('high-contrast');
  });
});
