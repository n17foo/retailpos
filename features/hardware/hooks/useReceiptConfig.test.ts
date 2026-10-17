import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useReceiptConfig } from './useReceiptConfig';
import { receiptConfigService } from '../services/printer/ReceiptConfigService';

const mockConfig = {
  printerModel: 'epson' as const,
  header: { lines: [{ text: 'Store', bold: true }] },
  footer: { lines: [{ text: 'Thanks' }] },
  options: { showLogo: false, paperWidth: 80 },
};

jest.mock('../services/printer/ReceiptConfigService', () => ({
  receiptConfigService: {
    initialize: jest.fn(),
    getConfig: jest.fn(() => mockConfig),
    updateHeader: jest.fn(),
    updateFooter: jest.fn(),
    updateOptions: jest.fn(),
    setPrinterModel: jest.fn(),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useReceiptConfig> | null = null;
  function Harness() {
    latest = useReceiptConfig();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useReceiptConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (receiptConfigService.initialize as jest.Mock).mockResolvedValue(undefined);
    (receiptConfigService.getConfig as jest.Mock).mockReturnValue(mockConfig);
  });

  it('initializes and loads receipt config on mount', async () => {
    const { get } = await mountHook();
    expect(receiptConfigService.initialize).toHaveBeenCalledTimes(1);
    expect(get().isLoading).toBe(false);
    expect(get().config).toEqual(mockConfig);
  });

  it('delegates header, footer, options, and printer model updates to receiptConfigService', async () => {
    const { get } = await mountHook();

    await act(async () => {
      await get().updateHeader({ businessName: 'Store' });
      await get().updateFooter({ line1: 'Thanks' });
      await get().updateOptions({ paperWidth: 58 } as never);
      await get().setPrinterModel('star');
    });

    expect(receiptConfigService.updateHeader).toHaveBeenCalledWith({ businessName: 'Store' });
    expect(receiptConfigService.updateFooter).toHaveBeenCalledWith({ line1: 'Thanks' });
    expect(receiptConfigService.updateOptions).toHaveBeenCalledWith({ paperWidth: 58 });
    expect(receiptConfigService.setPrinterModel).toHaveBeenCalledWith('star');
  });
});
