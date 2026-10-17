import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import PrinterSetupStep from './PrinterSetupStep';
import { PrinterConnectionType } from '../../hardware/services/printer/UnifiedPrinterService';

const mockSaveSettings = jest.fn().mockResolvedValue(true);

jest.mock('../../hardware/hooks/usePrinterSettings', () => ({
  usePrinterSettings: () => ({
    printerSettings: {
      enabled: true,
      connectionType: PrinterConnectionType.NETWORK,
      printerName: 'Receipt Printer',
      ipAddress: '192.168.1.20',
      port: 9100,
      macAddress: '',
      deviceName: '',
      deviceAddress: '',
      printReceipts: true,
    },
    handlePrinterSettingsChange: jest.fn(),
    testConnection: jest.fn().mockResolvedValue(true),
    loadSettings: jest.fn(),
    saveSettings: mockSaveSettings,
    isLoading: false,
  }),
}));

describe('PrinterSetupStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders printer form, supports Skip, and saves valid settings on Next', async () => {
    const onNext = jest.fn();
    const onSkip = jest.fn();
    const tree = await renderUi(<PrinterSetupStep onBack={jest.fn()} onNext={onNext} onSkip={onSkip} />);
    expect(hasText(tree, 'Configure Receipt Printer')).toBe(true);

    await pressByText(tree, 'Skip');
    expect(onSkip).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Next');
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
