import { useState, useEffect, useRef } from 'react';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { ScannerServiceFactory, ScannerType as ScannerTypeEnum } from '../services/scanner/scannerServiceFactory';
import { ScannerServiceInterface } from '../services/scanner/ScannerServiceInterface';
import { useLogger } from '../hooks/useLogger';

export type ScannerType = 'camera' | 'bluetooth' | 'usb' | 'qr_hardware';

/**
 * Map hook-level scanner type string to the factory enum value.
 */
function toFactoryType(type: ScannerType): ScannerTypeEnum | null {
  switch (type) {
    case 'bluetooth':
      return ScannerTypeEnum.BLUETOOTH;
    case 'usb':
      return ScannerTypeEnum.USB;
    case 'qr_hardware':
      return ScannerTypeEnum.QR_HARDWARE;
    case 'camera':
      return null; // camera handled separately
    default:
      return null;
  }
}

export interface ScannerSettings {
  enabled: boolean;
  type: ScannerType;
  deviceId: string;
}

const DEFAULT_SETTINGS: ScannerSettings = {
  enabled: true,
  type: 'camera',
  deviceId: '',
};

export const useScanner = () => {
  const [scannerSettings, setScannerSettings] = useState<ScannerSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const scannerFactory = ScannerServiceFactory.getInstance();
  const scannerServiceRef = useRef<ScannerServiceInterface | null>(null);
  const scanListenerRef = useRef<string | null>(null);
  const logger = useLogger('useScanner');

  // Load scanner settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await keyValueRepository.getObject<ScannerSettings>('scannerSettings');
        if (settings) {
          setScannerSettings(settings);
        }
      } catch (error) {
        logger.error({ message: 'Failed to load scanner settings' }, error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Cleanup scanner connections when component unmounts
    return () => {
      if (scanListenerRef.current && scannerServiceRef.current) {
        scannerServiceRef.current.stopScanListener(scanListenerRef.current);
        scanListenerRef.current = null;
      }
      scannerFactory.disconnectAll();
    };
  }, []);

  // Save scanner settings to storage
  const saveSettings = async (settings: ScannerSettings) => {
    try {
      await keyValueRepository.setItem('scannerSettings', settings);
      setScannerSettings(settings);
      return true;
    } catch (error) {
      logger.error({ message: 'Failed to save scanner settings' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  };

  // Handler for external scanner data
  const handleExternalScan = (callback: (data: string) => void) => {
    return {
      connect: async () => {
        if (scannerSettings.type === 'camera') {
          return false;
        }

        try {
          // Get the appropriate scanner service based on the scanner type
          const scannerType = toFactoryType(scannerSettings.type);
          if (!scannerType) {
            logger.error(`Unsupported external scanner type: ${scannerSettings.type}`);
            return false;
          }

          const service = scannerFactory.getService(scannerType);
          if (!service) {
            logger.error(`Failed to get scanner service for type: ${scannerSettings.type}`);
            return false;
          }

          scannerServiceRef.current = service;

          // Connect to the scanner device
          const connected = await service.connect(scannerSettings.deviceId);
          if (!connected) {
            logger.error(`Failed to connect to ${scannerSettings.type} scanner: ${scannerSettings.deviceId}`);
            return false;
          }

          // Start listening for scans (barcode or QR)
          const listenerId = service.startScanListener((data: string) => {
            callback(data);
          });

          scanListenerRef.current = listenerId;
          logger.info(`Connected to ${scannerSettings.type} scanner: ${scannerSettings.deviceId}`);
          return true;
        } catch (error) {
          logger.error(
            { message: `Error connecting to ${scannerSettings.type} scanner` },
            error instanceof Error ? error : new Error(String(error))
          );
          return false;
        }
      },
      disconnect: async () => {
        if (scannerSettings.type === 'camera') {
          return;
        }

        try {
          // Stop listening for scans
          if (scanListenerRef.current && scannerServiceRef.current) {
            scannerServiceRef.current.stopScanListener(scanListenerRef.current);
            scanListenerRef.current = null;
          }

          // Disconnect from the scanner
          if (scannerServiceRef.current) {
            await scannerServiceRef.current.disconnect();
            scannerServiceRef.current = null;
          }

          logger.info(`Disconnected from ${scannerSettings.type} scanner`);
        } catch (error) {
          logger.error(
            { message: `Error disconnecting from ${scannerSettings.type} scanner` },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
    };
  };

  // Discover available scanner devices based on the current scanner type
  const discoverDevices = async (): Promise<Array<{ id: string; name: string }>> => {
    if (scannerSettings.type === 'camera') {
      return [];
    }

    const scannerType = toFactoryType(scannerSettings.type);
    if (!scannerType) {
      return [];
    }

    const service = scannerFactory.getService(scannerType);
    if (!service) {
      logger.error(`Failed to get scanner service for type: ${scannerSettings.type}`);
      return [];
    }

    return service.discoverDevices();
  };

  // Test if the scanner connection works
  const testConnection = async (): Promise<boolean> => {
    if (scannerSettings.type === 'camera') {
      return true; // Camera is always available if permissions are granted
    }

    const scannerType = toFactoryType(scannerSettings.type);
    if (!scannerType) {
      return false;
    }

    const service = scannerFactory.getService(scannerType);
    if (!service) {
      return false;
    }

    return service.connect(scannerSettings.deviceId);
  };

  return {
    scannerSettings,
    isLoading,
    saveSettings,
    handleExternalScan,
    discoverDevices,
    testConnection,
  };
};
