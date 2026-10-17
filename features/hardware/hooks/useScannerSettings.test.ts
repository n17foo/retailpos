import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useScannerSettings } from './useScannerSettings';
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

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getObject: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('../services/scanner/ScannerServiceFactory', () => ({
  ScannerType: {
    BLUETOOTH: 'bluetooth',
    USB: 'usb',
    QR_HARDWARE: 'qr_hardware',
  },
  ScannerServiceFactory: {
    getInstance: () => ({
      getService: () => mockService,
    }),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useScannerSettings> | null = null;
  function Harness() {
    latest = useScannerSettings();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useScannerSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (keyValueRepository.getObject as jest.Mock).mockResolvedValue({ enabled: true, type: 'usb', deviceId: 'dev-1' });
    (keyValueRepository.setItem as jest.Mock).mockResolvedValue(undefined);
    mockService.connect.mockResolvedValue(true);
    mockService.disconnect.mockResolvedValue(undefined);
  });

  it('loads stored scanner settings on mount', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().scannerSettings.type).toBe('usb');
    expect(get().scannerSettings.deviceId).toBe('dev-1');
  });

  it('updates, saves, and tests scanner connection', async () => {
    const { get } = await mountHook();

    act(() => {
      get().handleScannerSettingsChange({ deviceId: 'dev-2' });
    });
    expect(get().saveStatus).toBe('unsaved');

    await act(async () => {
      await get().saveSettings(get().scannerSettings);
    });
    expect(get().saveStatus).toBe('saved');

    let ok = false;
    await act(async () => {
      ok = await get().testConnection(get().scannerSettings);
    });
    expect(ok).toBe(true);
    expect(mockService.connect).toHaveBeenCalledWith('dev-2');
    expect(mockService.disconnect).toHaveBeenCalled();
  });
});
