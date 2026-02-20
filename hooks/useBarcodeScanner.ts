import { useState, useRef, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { ScannerType, ScannerServiceFactory } from '../services/scanner/scannerServiceFactory';
import { ScannerServiceInterface } from '../services/scanner/ScannerServiceInterface';
import { formatMoney } from '../utils/money';
import { useCurrency } from './useCurrency';

interface ScannerSettings {
  type: 'camera' | 'bluetooth' | 'usb' | 'qr_hardware';
  deviceId?: string;
}

// Import type locally to avoid circular dependencies
interface Product {
  id: string;
  name: string;
  price: number;
  barcode?: string;
}

interface UseBarcodeScannerServiceProps {
  scannerSettings: ScannerSettings;
  products: Product[];
  onScanSuccess: (productId: string) => void;
}

export const useBarcodeScanner = ({ scannerSettings, products, onScanSuccess }: UseBarcodeScannerServiceProps) => {
  const currency = useCurrency();
  // Scanner state
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Refs to avoid stale closures and manage scanner service lifecycle
  const scannerServiceRef = useRef<ScannerServiceInterface | null>(null);
  const scanListenerRef = useRef<string | null>(null);
  const scanCallbackRef = useRef<((data: string) => void) | null>(null);

  // Get scanner factory instance
  const scannerFactory = ScannerServiceFactory.getInstance();

  /**
   * Safely execute scanner operations with error handling
   */
  const executeScannerOperation = useCallback(async (operation: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      console.error(`Error ${operation}:`, error);
    }
  }, []);

  /**
   * Display scanner-related alerts
   */
  const showScannerAlert = useCallback((title: string, message: string, actions: Array<{ text: string; onPress: () => void }> = []) => {
    const defaultActions = actions.length > 0 ? actions : [{ text: 'OK', onPress: () => {} }];
    Alert.alert(title, message, defaultActions);
  }, []);

  // Disconnect the scanner
  const disconnectScanner = useCallback(async () => {
    await executeScannerOperation('disconnecting scanner', async () => {
      // Stop the scan listener if active
      if (scanListenerRef.current && scannerServiceRef.current) {
        scannerServiceRef.current.stopScanListener(scanListenerRef.current);
        scanListenerRef.current = null;
      }

      // Disconnect the scanner
      if (scannerServiceRef.current) {
        await scannerServiceRef.current.disconnect();
        scannerServiceRef.current = null;
      }

      setConnected(false);
    });
  }, [executeScannerOperation]);

  // Process barcode data from any scanner type
  const processBarcodeData = useCallback(
    (data: string) => {
      // Find product with barcode matching scanned data
      const product = products.find(p => p.id === data || p.barcode === data);

      if (product) {
        // Product found
        showScannerAlert('Product Found', `Found: ${product.name} - ${formatMoney(product.price, currency.code)}`, [
          {
            text: 'Add to Cart',
            onPress: () => {
              onScanSuccess(product.id);
              setScanned(false);
            },
          },
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
        ]);
      } else {
        // Product not found
        showScannerAlert('Product Not Found', `No product found with barcode: ${data}`, [
          {
            text: 'Scan Again',
            onPress: () => setScanned(false),
          },
        ]);
      }
    },
    [products, onScanSuccess, showScannerAlert]
  );

  // Connect to scanner
  const connectScanner = useCallback(async () => {
    setConnecting(true);

    try {
      // First disconnect any existing scanner
      await disconnectScanner();

      // Create the scan callback and save it in a ref to avoid stale closures
      const scanCallback = (data: string) => {
        if (scanned) return;
        setScanned(true);
        processBarcodeData(data);
      };
      scanCallbackRef.current = scanCallback;

      await executeScannerOperation('initializing scanner', async () => {
        // Get the appropriate scanner type
        let scannerType: ScannerType;
        switch (scannerSettings.type) {
          case 'camera':
            scannerType = ScannerType.CAMERA;
            break;
          case 'bluetooth':
            scannerType = ScannerType.BLUETOOTH;
            break;
          case 'qr_hardware':
            scannerType = ScannerType.QR_HARDWARE;
            break;
          default:
            scannerType = ScannerType.USB;
            break;
        }

        // Get the scanner service from the factory
        const scannerService = scannerFactory.getService(scannerType);
        if (!scannerService) {
          showScannerAlert('Error', `Failed to initialize ${scannerSettings.type} scanner.`);
          throw new Error(`Failed to get scanner service for type: ${scannerSettings.type}`);
        }

        // Store the scanner service
        scannerServiceRef.current = scannerService;

        // Connect to the scanner
        const deviceId = scannerSettings.type === 'camera' ? 'back' : scannerSettings.deviceId;
        const isConnected = await scannerService.connect(deviceId);
        setConnected(isConnected);

        if (!isConnected) {
          showScannerAlert('Connection Failed', `Unable to connect to ${scannerSettings.type} scanner. Please check your settings.`);
          throw new Error(`Failed to connect to ${scannerSettings.type} scanner`);
        }

        // Start listening for barcode scans
        if (scannerSettings.type === 'camera') {
          // For camera scanner, we don't need to start a listener as we'll use the CameraView component
          // But we'll store the service so we can trigger scan events
          setHasPermission(true);
        } else {
          // For external scanners, start the scan listener
          const listenerId = scannerService.startScanListener(scanCallback);
          scanListenerRef.current = listenerId;
        }
      });
    } catch (error) {
      showScannerAlert('Error', `Failed to connect to ${scannerSettings.type} scanner.`);
    } finally {
      setConnecting(false);
    }
  }, [disconnectScanner, executeScannerOperation, processBarcodeData, scannerSettings, scanned, showScannerAlert]);

  // Handle camera barcode scanning
  const handleBarCodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      setScanned(true);
      processBarcodeData(data);
    },
    [processBarcodeData]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectScanner();
    };
  }, [disconnectScanner]);

  return {
    hasPermission,
    scanned,
    connected,
    connecting,
    setScanned,
    connectScanner,
    disconnectScanner,
    handleBarCodeScanned,
  };
};
