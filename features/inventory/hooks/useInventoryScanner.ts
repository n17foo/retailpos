import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { ScannerServiceFactory, ScannerType } from '../../hardware/services/scanner/ScannerServiceFactory';
import { ScannerServiceInterface } from '../../hardware/services/scanner/ScannerServiceInterface';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { useLogger } from '../../../shared/hooks/useLogger';
import { findInventoryScanMatch, InventoryItem } from '../utils/inventoryScanner.utils';

export type { InventoryItem };

interface UseInventoryScannerReturn {
  scanModeActive: boolean;
  toggleScanMode: () => Promise<void>;
}

/**
 * Manages barcode scanner lifecycle for the Inventory screen.
 * On scan: matches by SKU or productId, calls onMatch with the item key and name.
 * On no match: shows an alert.
 */
export function useInventoryScanner(
  inventoryItems: InventoryItem[],
  onMatch: (itemKey: string, itemName: string, quantity: number) => void
): UseInventoryScannerReturn {
  const logger = useLogger('useInventoryScanner');
  const [scanModeActive, setScanModeActive] = useState(false);
  const scannerServiceRef = useRef<ScannerServiceInterface | null>(null);
  const scanListenerRef = useRef<string | null>(null);

  const stopScanner = useCallback(() => {
    if (scanListenerRef.current && scannerServiceRef.current) {
      scannerServiceRef.current.stopScanListener(scanListenerRef.current);
      scanListenerRef.current = null;
    }
    scannerServiceRef.current?.disconnect();
    scannerServiceRef.current = null;
  }, []);

  const handleScan = useCallback(
    (barcode: string) => {
      const match = findInventoryScanMatch(barcode, inventoryItems);
      if (match) {
        onMatch(match.itemKey, match.itemName, match.quantity);
      } else {
        Alert.alert('Not Found', `No inventory item found for barcode: ${barcode}`);
      }
    },
    [inventoryItems, onMatch]
  );

  const toggleScanMode = useCallback(async () => {
    if (scanModeActive) {
      stopScanner();
      setScanModeActive(false);
      return;
    }
    try {
      const settings = await keyValueRepository.getObject<{ type?: string; deviceId?: string }>('scannerSettings');
      const typeStr = settings?.type ?? 'usb';
      const typeMap: Record<string, ScannerType> = {
        camera: ScannerType.CAMERA,
        bluetooth: ScannerType.BLUETOOTH,
        usb: ScannerType.USB,
        qr_hardware: ScannerType.QR_HARDWARE,
      };
      const scannerType = typeMap[typeStr] ?? ScannerType.USB;
      const service = ScannerServiceFactory.getInstance().getService(scannerType);
      if (!service) return;

      const connected = await service.connect(settings?.deviceId ?? '');
      if (!connected) {
        Alert.alert('Scanner Error', 'Could not connect to scanner. Check Settings → Scanner.');
        return;
      }
      scannerServiceRef.current = service;
      scanListenerRef.current = service.startScanListener(handleScan);
      setScanModeActive(true);
    } catch (err) {
      logger.error({ message: 'Failed to start inventory scanner' }, err instanceof Error ? err : new Error(String(err)));
    }
  }, [scanModeActive, stopScanner, handleScan, logger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return { scanModeActive, toggleScanMode };
}
