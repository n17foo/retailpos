import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useEcommerceSettings } from './useEcommerceSettings';
import { EcommerceSettingsStorage } from '../services/config/EcommerceSettingsStorage';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../services/config/EcommerceSettingsStorage', () => ({
  EcommerceSettingsStorage: {
    load: jest.fn(),
    save: jest.fn(),
  },
}));

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const mockConfigureFromStorage = jest.fn();
const mockTestConnection = jest.fn();
const mockReset = jest.fn();

jest.mock('../services/config/ServiceConfigBridge', () => ({
  ServiceConfigBridge: {
    getInstance: () => ({
      configureFromStorage: mockConfigureFromStorage,
      testConnection: mockTestConnection,
      reset: mockReset,
    }),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useEcommerceSettings> | null = null;
  function Harness() {
    latest = useEcommerceSettings();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useEcommerceSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (EcommerceSettingsStorage.load as jest.Mock).mockResolvedValue(null);
    (keyValueRepository.getItem as jest.Mock).mockResolvedValue(null);
    mockConfigureFromStorage.mockResolvedValue(true);
    mockTestConnection.mockResolvedValue({ success: true, message: 'Connected' });
  });

  it('loads defaults when no settings exist in storage', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().isInitialized).toBe(false);
    expect(get().ecommerceSettings.enabled).toBe(true);
  });

  it('updates nested platform settings and tracks unsaved changes', async () => {
    const { get } = await mountHook();

    act(() => {
      get().updateSettings({
        platform: 'shopify',
        shopify: { apiKey: 'k1', accessToken: 'tok', storeUrl: 'shop.myshopify.com' },
      });
    });

    expect(get().hasUnsavedChanges).toBe(true);
    expect(get().ecommerceSettings.shopify.storeUrl).toBe('shop.myshopify.com');

    act(() => {
      get().cancelChanges();
    });
    expect(get().hasUnsavedChanges).toBe(false);
  });

  it('saves settings and configures ServiceConfigBridge', async () => {
    const { get } = await mountHook();

    act(() => {
      get().updateSettings({ platform: 'shopify', enabled: true });
    });

    let ok = false;
    await act(async () => {
      ok = await get().saveSettings();
    });

    expect(ok).toBe(true);
    expect(EcommerceSettingsStorage.save).toHaveBeenCalled();
    expect(keyValueRepository.setItem).toHaveBeenCalledWith('ecommercePlatform', 'shopify');
    expect(mockConfigureFromStorage).toHaveBeenCalled();
  });
});
