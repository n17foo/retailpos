import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useScanner } from './useScanner';
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

const mockScannerService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  startScanListener: jest.fn(() => 'listener-1'),
  stopScanListener: jest.fn(),
  discoverDevices: jest.fn(),
};

const mockScannerFactory = {
  getService: jest.fn(() => mockScannerService),
  disconnectAll: jest.fn(),
};

jest.mock('../services/scanner/BluetoothScannerService', () => ({
  BluetoothScannerService: class {},
}));

jest.mock('../services/scanner/ScannerServiceFactory', () => ({
  ScannerType: {
    BLUETOOTH: 'bluetooth',
    USB: 'usb',
    QR_HARDWARE: 'qr_hardware',
    CAMERA: 'camera',
  },
  ScannerServiceFactory: {
    getInstance: () => mockScannerFactory,
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useScanner> | null = null;
  function Harness() {
    latest = useScanner();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (keyValueRepository.getObject as jest.Mock).mockResolvedValue(null);
    (keyValueRepository.setItem as jest.Mock).mockResolvedValue(undefined);
    mockScannerService.connect.mockResolvedValue(true);
    mockScannerService.discoverDevices.mockResolvedValue([{ id: 'd1', name: 'Scanner 1' }]);
  });

  it('loads default camera scanner settings when none are stored', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().scannerSettings.type).toBe('camera');
    expect(await get().testConnection()).toBe(true);
  });

  it('saves USB scanner settings and connects external scan listener', async () => {
    const { get } = await mountHook();

    await act(async () => {
      await get().saveSettings({
        ...get().scannerSettings,
        type: 'usb',
        deviceId: 'usb-1',
      });
    });

    const onScan = jest.fn();
    let connected = false;
    await act(async () => {
      connected = await get().handleExternalScan(onScan).connect();
    });

    expect(connected).toBe(true);
    expect(mockScannerService.connect).toHaveBeenCalledWith('usb-1');
    expect(mockScannerService.startScanListener).toHaveBeenCalled();
  });
});
