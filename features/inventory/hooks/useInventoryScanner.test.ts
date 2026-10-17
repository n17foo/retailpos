import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useInventoryScanner } from './useInventoryScanner';

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
    getObject: jest.fn().mockResolvedValue({ type: 'usb', deviceId: 'usb-1' }),
  },
}));

let capturedScanHandler: ((barcode: string) => void) | null = null;
const mockScannerService = {
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn(),
  startScanListener: jest.fn((cb: (barcode: string) => void) => {
    capturedScanHandler = cb;
    return 'sub-1';
  }),
  stopScanListener: jest.fn(),
};

jest.mock('../../hardware/services/scanner/ScannerServiceFactory', () => ({
  ScannerType: {
    CAMERA: 'camera',
    BLUETOOTH: 'bluetooth',
    USB: 'usb',
    QR_HARDWARE: 'qr_hardware',
  },
  ScannerServiceFactory: {
    getInstance: () => ({
      getService: () => mockScannerService,
    }),
  },
}));

describe('useInventoryScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedScanHandler = null;
  });

  it('toggles scan mode on/off and invokes onMatch when a scanned barcode matches', async () => {
    const items = [{ productId: 'p1', variantId: 'v1', name: 'Coffee', sku: 'SKU-123', quantity: 7 }];
    const onMatch = jest.fn();

    let latest: ReturnType<typeof useInventoryScanner> | null = null;
    function Harness() {
      latest = useInventoryScanner(items, onMatch);
      return null;
    }

    act(() => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latest!.scanModeActive).toBe(false);

    await act(async () => {
      await latest!.toggleScanMode();
    });

    expect(latest!.scanModeActive).toBe(true);
    expect(mockScannerService.connect).toHaveBeenCalledWith('usb-1');
    expect(capturedScanHandler).not.toBeNull();

    act(() => {
      capturedScanHandler!('SKU-123');
    });

    expect(onMatch).toHaveBeenCalledWith('p1-v1', 'Coffee', 7);

    await act(async () => {
      await latest!.toggleScanMode();
    });

    expect(latest!.scanModeActive).toBe(false);
    expect(mockScannerService.stopScanListener).toHaveBeenCalledWith('sub-1');
  });
});
