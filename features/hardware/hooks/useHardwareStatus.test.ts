import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useHardwareStatus } from './useHardwareStatus';

async function mountHook(services: Parameters<typeof useHardwareStatus>[0]) {
  let latest: ReturnType<typeof useHardwareStatus> | null = null;
  function Harness() {
    latest = useHardwareStatus(services, 5000);
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useHardwareStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports disconnected for all missing services', async () => {
    const { get } = await mountHook({});
    expect(get().status.printer.connected).toBe(false);
    expect(get().status.scanner.connected).toBe(false);
    expect(get().status.drawer.connected).toBe(false);
    expect(get().status.kds.connected).toBe(false);
    expect(get().status.display.connected).toBe(false);
  });

  it('aggregates live status from provided hardware services', async () => {
    const services = {
      printer: {
        isConnected: () => true,
        getStatus: jest.fn().mockResolvedValue({ paperOut: false, paperLow: true, offline: false, error: false }),
      } as unknown as NonNullable<Parameters<typeof useHardwareStatus>[0]['printer']>,
      scanner: {
        isConnected: () => true,
        driverType: 'usb' as const,
      } as unknown as NonNullable<Parameters<typeof useHardwareStatus>[0]['scanner']>,
      drawer: {
        driverType: 'printer' as const,
        open: jest.fn(),
        isOpen: jest.fn().mockResolvedValue(false),
      },
      kds: {
        isConnected: () => true,
      } as unknown as NonNullable<Parameters<typeof useHardwareStatus>[0]['kds']>,
      display: {
        isConnected: () => true,
        driverType: 'websocket' as const,
      } as unknown as NonNullable<Parameters<typeof useHardwareStatus>[0]['display']>,
    };

    const { get } = await mountHook(services);

    expect(get().status.printer.connected).toBe(true);
    expect(get().status.printer.status).toBe('paper_low');
    expect(get().status.scanner.connected).toBe(true);
    expect(get().status.drawer.connected).toBe(true);
    expect(get().status.drawer.isOpen).toBe(false);
    expect(get().status.kds.connected).toBe(true);
    expect(get().status.display.connected).toBe(true);
  });
});
