import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useCashDrawerStatus } from './useCashDrawerStatus';
import type { CashDrawerServiceInterface } from '../services/drawer/CashDrawerServiceInterface';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

async function mountHook(drawerService: CashDrawerServiceInterface | null, pollIntervalMs = 1000) {
  let latest: ReturnType<typeof useCashDrawerStatus> | null = null;
  function Harness() {
    latest = useCashDrawerStatus(drawerService, pollIntervalMs);
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useCashDrawerStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not poll when drawerService is null or driverType is none', async () => {
    const { get } = await mountHook(null);
    expect(get().isPolling).toBe(false);
    expect(get().isOpen).toBeUndefined();
  });

  it('polls drawer status immediately and on interval', async () => {
    const mockDrawer: CashDrawerServiceInterface = {
      driverType: 'printer',
      open: jest.fn(),
      isOpen: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    };

    const { get } = await mountHook(mockDrawer, 1000);
    expect(get().isPolling).toBe(true);
    expect(get().isOpen).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(get().isOpen).toBe(true);
  });
});
