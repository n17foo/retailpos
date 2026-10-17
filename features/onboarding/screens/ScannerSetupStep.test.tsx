import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import ScannerSetupStep from './ScannerSetupStep';

const mockSaveSettings = jest.fn().mockResolvedValue(true);

jest.mock('../../hardware/hooks/useScannerSettings', () => ({
  useScannerSettings: () => ({
    scannerSettings: {
      enabled: true,
      type: 'camera',
      deviceId: '',
    },
    handleScannerSettingsChange: jest.fn(),
    saveSettings: mockSaveSettings,
    testConnection: jest.fn().mockResolvedValue(true),
    isLoading: false,
    loadSettings: jest.fn(),
  }),
}));

describe('ScannerSetupStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders scanner type options and completes setup', async () => {
    const onComplete = jest.fn();
    const tree = await renderUi(<ScannerSetupStep onBack={jest.fn()} onComplete={onComplete} />);
    expect(hasText(tree, 'Configure Scanner')).toBe(true);
    expect(hasText(tree, 'Camera')).toBe(true);

    await pressByText(tree, 'Finish');
    expect(mockSaveSettings).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
