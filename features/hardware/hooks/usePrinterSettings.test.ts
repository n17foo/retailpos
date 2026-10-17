import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { usePrinterSettings } from './usePrinterSettings';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { PrinterConnectionType } from '../services/printer/UnifiedPrinterService';
import { PrinterServiceFactory } from '../services/printer/PrinterServiceFactory';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

const mockT = jest.fn((key: string, opts?: Record<string, unknown> | string) => {
  if (typeof opts === 'string') return opts;
  if (opts && typeof opts.defaultValue === 'string') return opts.defaultValue;
  return key;
});

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: mockT }),
}));

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getObject: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockTestConnection = jest.fn();

jest.mock('../services/printer/PrinterServiceFactory', () => ({
  PrinterServiceFactory: {
    getInstance: () => ({
      testConnection: mockTestConnection,
    }),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof usePrinterSettings> | null = null;
  function Harness() {
    latest = usePrinterSettings();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('usePrinterSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (keyValueRepository.getObject as jest.Mock).mockResolvedValue(null);
    (keyValueRepository.setItem as jest.Mock).mockResolvedValue(undefined);
    mockTestConnection.mockResolvedValue(true);
  });

  it('loads default printer settings when storage is empty', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().printerSettings.connectionType).toBe(PrinterConnectionType.BLUETOOTH);
  });

  it('rejects saving invalid printer settings', async () => {
    const { get } = await mountHook();

    let saved = true;
    await act(async () => {
      saved = await get().saveSettings(get().printerSettings);
    });

    expect(saved).toBe(false);
    expect(get().saveStatus).toBe('error');
    expect(keyValueRepository.setItem).not.toHaveBeenCalled();
  });

  it('saves valid network printer settings and tests connection', async () => {
    const { get } = await mountHook();
    const validSettings = {
      ...get().printerSettings,
      enabled: true,
      printerName: 'Front Till',
      connectionType: PrinterConnectionType.NETWORK,
      ipAddress: '192.168.1.50',
      port: 9100,
    };

    let saved = false;
    await act(async () => {
      saved = await get().saveSettings(validSettings);
    });

    expect(saved).toBe(true);
    expect(keyValueRepository.setItem).toHaveBeenCalledWith('printerSettings', validSettings);
    expect(get().saveStatus).toBe('saved');

    let connected = false;
    await act(async () => {
      connected = await get().testConnection(validSettings);
    });
    expect(connected).toBe(true);
    expect(PrinterServiceFactory.getInstance().testConnection).toHaveBeenCalled();
  });
});
