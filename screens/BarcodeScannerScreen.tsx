import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import { useEcommerceProducts } from '../hooks/useEcommerceProducts';
import { useBarcodeScannerService } from '../hooks/useBarcodeScannerService';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';

interface BarcodeScannerScreenProps {
  onScanSuccess: (productId: string) => void;
  onClose: () => void;
}

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({ onScanSuccess, onClose }) => {
  // Get scanner settings from local storage or default
  const scannerSettings = {
    type: 'camera' as 'camera' | 'bluetooth' | 'usb',
    enabled: true,
    deviceId: 'back',
  };

  // Get products from the product service
  const { products } = useEcommerceProducts();

  // Use our custom hook for barcode scanner functionality
  const { hasPermission, scanned, connected, connecting, setScanned, connectScanner, disconnectScanner, handleBarCodeScanned } =
    useBarcodeScannerService({
      scannerSettings,
      products,
      onScanSuccess,
    });

  // Set up scanner when component mounts
  useEffect(() => {
    if (scannerSettings.enabled) {
      connectScanner();
    }

    // Cleanup function to disconnect scanner when component unmounts
    return () => {
      disconnectScanner();
    };
  }, [connectScanner, disconnectScanner, scannerSettings.enabled]);

  // Handle permission denied
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.externalScannerTitle}>Camera Permission Required</Text>
        <Text style={styles.externalScannerText}>Please grant camera permission to use the barcode scanner.</Text>
        <TouchableOpacity style={[styles.button, styles.reconnectButton]} onPress={connectScanner}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading indicator while connecting
  if (connecting) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.externalScannerText}>Connecting to {scannerSettings.type} scanner...</Text>
      </View>
    );
  }

  // External scanner view (USB or Bluetooth)
  if (scannerSettings.type !== 'camera') {
    return (
      <View style={styles.externalScannerContainer}>
        <View style={styles.externalScannerContent}>
          {connecting ? (
            <>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.externalScannerText}>Connecting to {scannerSettings.type} scanner...</Text>
            </>
          ) : connected ? (
            <>
              <Text style={styles.externalScannerTitle}>{scannerSettings.type.toUpperCase()} Scanner Connected</Text>
              <Text style={styles.externalScannerText}>Ready to scan products</Text>
              {scanned && <Text style={styles.externalScannerStatus}>Processing scan...</Text>}
            </>
          ) : (
            <>
              <Text style={styles.externalScannerTitle}>Scanner Not Connected</Text>
              <Text style={styles.externalScannerText}>Unable to connect to {scannerSettings.type} scanner.</Text>
              <TouchableOpacity style={[styles.button, styles.reconnectButton]} onPress={connectScanner}>
                <Text style={styles.buttonText}>Reconnect</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera scanner view (default)
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_e'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        <Text style={styles.scanText}>Align barcode within the frame</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>

        {scanned && (
          <TouchableOpacity style={[styles.button, styles.scanAgainButton]} onPress={() => setScanned(false)}>
            <Text style={styles.buttonText}>Scan Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: lightColors.overlay,
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: lightColors.primary,
    backgroundColor: 'transparent',
    marginBottom: spacing.lg,
  },
  scanText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    paddingHorizontal: spacing.lg,
  },
  button: {
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
    ...elevation.medium,
  },
  scanAgainButton: {
    backgroundColor: lightColors.success,
  },
  reconnectButton: {
    backgroundColor: lightColors.success,
    marginTop: spacing.lg,
  },
  buttonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold as 'bold',
  },
  externalScannerContainer: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  externalScannerContent: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
  externalScannerTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold as 'bold',
    marginBottom: spacing.lg,
    textAlign: 'center' as const,
    color: lightColors.textPrimary,
  },
  externalScannerText: {
    fontSize: typography.fontSize.md,
    textAlign: 'center' as const,
    marginBottom: spacing.xl,
    color: lightColors.textSecondary,
  },
  externalScannerStatus: {
    fontSize: typography.fontSize.md,
    color: lightColors.primary,
    marginTop: spacing.lg,
  },
});
