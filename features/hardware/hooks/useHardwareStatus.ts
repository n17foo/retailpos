import { useState, useEffect, useCallback } from 'react';
import { CashDrawerServiceInterface } from '../services/drawer/CashDrawerServiceInterface';
import { BasePrinterService } from '../services/printer/BasePrinterService';
import { ScannerServiceInterface } from '../services/scanner/ScannerServiceInterface';
import { KdsServiceInterface } from '../services/kds/KdsServiceInterface';
import { CustomerDisplayServiceInterface } from '../services/display/CustomerDisplayServiceInterface';

export interface HardwareStatus {
  printer: {
    connected: boolean;
    status?: 'ready' | 'error' | 'paper_low' | 'paper_out' | 'offline';
    message?: string;
    lastChecked?: number;
  };
  scanner: {
    connected: boolean;
    type?: 'bluetooth' | 'usb' | 'camera' | 'qr_hardware' | 'mock';
    deviceName?: string;
    lastChecked?: number;
  };
  drawer: {
    connected: boolean;
    isOpen?: boolean;
    lastChecked?: number;
  };
  kds: {
    connected: boolean;
    vendor?: string;
    lastTicketSent?: number;
    lastChecked?: number;
  };
  display: {
    connected: boolean;
    type?: 'websocket' | 'none';
    lastChecked?: number;
  };
}

interface HardwareServices {
  printer?: BasePrinterService | null;
  scanner?: ScannerServiceInterface | null;
  drawer?: CashDrawerServiceInterface | null;
  kds?: KdsServiceInterface | null;
  display?: CustomerDisplayServiceInterface | null;
}

/**
 * Hook to monitor status of all hardware devices
 * Polls each device at regular intervals
 */
export function useHardwareStatus(
  services: HardwareServices,
  pollIntervalMs: number = 10000 // 10 seconds
) {
  const [status, setStatus] = useState<HardwareStatus>({
    printer: { connected: false },
    scanner: { connected: false },
    drawer: { connected: false },
    kds: { connected: false },
    display: { connected: false },
  });
  const [isPolling, setIsPolling] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const checkPrinterStatus = useCallback(async () => {
    if (!services.printer) {
      return { connected: false };
    }

    try {
      const connected = services.printer.isConnected();
      if (!connected) {
        return { connected: false, lastChecked: Date.now() };
      }

      const printerStatus = await services.printer.getStatus();

      let status: 'ready' | 'error' | 'paper_low' | 'paper_out' | 'offline' = 'ready';
      let message: string | undefined;

      if (printerStatus.paperOut) {
        status = 'paper_out';
        message = 'Paper out - please refill';
      } else if (printerStatus.paperLow) {
        status = 'paper_low';
        message = 'Paper low - refill soon';
      } else if (printerStatus.offline) {
        status = 'offline';
        message = 'Printer offline';
      } else if (printerStatus.error) {
        status = 'error';
        message = 'Printer error';
      }

      return {
        connected: true,
        status,
        message,
        lastChecked: Date.now(),
      };
    } catch (error) {
      return {
        connected: false,
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: Date.now(),
      };
    }
  }, [services.printer]);

  const checkScannerStatus = useCallback(async () => {
    if (!services.scanner) {
      return { connected: false };
    }

    try {
      const connected = services.scanner.isConnected();
      return {
        connected,
        type: services.scanner.driverType,
        lastChecked: Date.now(),
      };
    } catch {
      return { connected: false, lastChecked: Date.now() };
    }
  }, [services.scanner]);

  const checkDrawerStatus = useCallback(async () => {
    if (!services.drawer || services.drawer.driverType === 'none') {
      return { connected: false };
    }

    try {
      const isOpen = await services.drawer.isOpen();
      return {
        connected: true,
        isOpen: isOpen ?? undefined,
        lastChecked: Date.now(),
      };
    } catch {
      return { connected: false, lastChecked: Date.now() };
    }
  }, [services.drawer]);

  const checkKdsStatus = useCallback(async () => {
    if (!services.kds) {
      return { connected: false };
    }

    try {
      const connected = services.kds.isConnected();
      return {
        connected,
        lastChecked: Date.now(),
      };
    } catch {
      return { connected: false, lastChecked: Date.now() };
    }
  }, [services.kds]);

  const checkDisplayStatus = useCallback(async () => {
    if (!services.display) {
      return { connected: false };
    }

    try {
      const connected = services.display.isConnected();
      return {
        connected,
        type: services.display.driverType,
        lastChecked: Date.now(),
      };
    } catch {
      return { connected: false, lastChecked: Date.now() };
    }
  }, [services.display]);

  const checkAllStatus = useCallback(async () => {
    try {
      setLastError(null);
      const [printer, scanner, drawer, kds, display] = await Promise.all([
        checkPrinterStatus(),
        checkScannerStatus(),
        checkDrawerStatus(),
        checkKdsStatus(),
        checkDisplayStatus(),
      ]);

      setStatus({
        printer,
        scanner,
        drawer,
        kds,
        display,
      });
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Failed to check hardware status');
    }
  }, [checkPrinterStatus, checkScannerStatus, checkDrawerStatus, checkKdsStatus, checkDisplayStatus]);

  useEffect(() => {
    setIsPolling(true);
    checkAllStatus(); // Check immediately

    const intervalId = setInterval(checkAllStatus, pollIntervalMs);

    return () => {
      clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [checkAllStatus, pollIntervalMs]);

  return {
    status,
    isPolling,
    lastError,
    refresh: checkAllStatus,
  };
}
