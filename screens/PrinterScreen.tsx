import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useBasketContext } from '../contexts/BasketProvider';
import { PrinterConfig, ReceiptData } from '../services/printer/PrinterTypes';
import { PrinterServiceFactory } from '../services/printer/PrinterServiceFactory';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';

interface PrinterScreenProps {
  onGoBack?: () => void;
}

const PrinterScreen: React.FC<PrinterScreenProps> = ({ onGoBack }) => {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterConfig | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { cartItems, total, clearCart } = useBasketContext();
  const printerService = PrinterServiceFactory.getInstance();

  useEffect(() => {
    // Load available printers
    const loadPrinters = () => {
      const availablePrinters = printerService.getAvailablePrinters();
      setPrinters(availablePrinters);

      // Check if already connected to a printer
      if (printerService.isConnectedToPrinter()) {
        setSelectedPrinter(printerService.getActivePrinter());
      }
    };

    loadPrinters();
  }, []);

  const handleConnectPrinter = async (printer: PrinterConfig) => {
    try {
      setIsConnecting(true);
      const success = await printerService.connectToPrinter(printer.printerName);

      if (success) {
        setSelectedPrinter(printer);
        Alert.alert('Connected', `Successfully connected to ${printer.printerName}`);
      } else {
        Alert.alert('Connection Failed', `Could not connect to ${printer.printerName}`);
      }
    } catch (error) {
      Alert.alert('Error', `Error connecting to printer: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!selectedPrinter) {
      Alert.alert('No Printer Selected', 'Please connect to a printer first.');
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'There are no items in the cart to print.');
      return;
    }

    try {
      setIsPrinting(true);

      // Create receipt data from cart items
      const receiptData: ReceiptData = {
        orderId: `ORD-${Date.now().toString().slice(-6)}`,
        items: cartItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: total,
        tax: total * 0.08, // 8% tax for example
        total: total * 1.08,
        paymentMethod: 'Card',
        date: new Date(),
        cashierName: 'Cashier',
      };

      const success = await printerService.printReceipt(receiptData);

      if (success) {
        Alert.alert('Success', 'Receipt printed successfully.', [
          {
            text: 'Clear Cart',
            onPress: () => {
              clearCart();
              if (onGoBack) onGoBack();
            },
          },
          {
            text: 'Keep Items',
            onPress: () => {
              if (onGoBack) onGoBack();
            },
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to print receipt.');
      }
    } catch (error) {
      Alert.alert('Error', `Error printing receipt: ${error}`);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thermal Printer Management</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Printers</Text>
        {printers.length === 0 ? (
          <Text style={styles.noData}>No printers found.</Text>
        ) : (
          <FlatList
            data={printers}
            keyExtractor={item => item.printerName}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.printerItem, selectedPrinter?.printerName === item.printerName && styles.selectedPrinter]}
                onPress={() => handleConnectPrinter(item)}
                disabled={isConnecting}
              >
                <View style={styles.printerInfo}>
                  <Text style={styles.printerName}>{item.printerName}</Text>
                  <Text style={styles.printerAddress}>{item.ipAddress ? `IP: ${item.ipAddress}:${item.port}` : `USB: ${item.usbId}`}</Text>
                  <Text style={styles.printerDetails}>Paper Width: {item.paperWidth}mm</Text>
                </View>

                {selectedPrinter?.printerName === item.printerName ? (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Connected</Text>
                  </View>
                ) : (
                  <Text style={styles.connectText}>Connect</Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={styles.actions}>
        {isConnecting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Connecting to printer...</Text>
          </View>
        )}

        {isPrinting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Printing receipt...</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.printButton, (!selectedPrinter || cartItems.length === 0) && styles.disabledButton]}
          onPress={handlePrintReceipt}
          disabled={!selectedPrinter || cartItems.length === 0 || isPrinting}
        >
          <Text style={styles.printButtonText}>Print Receipt ({cartItems.length} items)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            if (onGoBack) onGoBack();
          }}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: lightColors.background,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold as 'bold',
    marginBottom: spacing.lg,
    textAlign: 'center' as const,
    color: lightColors.textPrimary,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flex: 1,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as 'bold',
    marginBottom: spacing.md,
    color: lightColors.textPrimary,
  },
  noData: {
    textAlign: 'center' as const,
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.lg,
  },
  printerItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.inputBackground,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  selectedPrinter: {
    borderColor: lightColors.primary,
    backgroundColor: `${lightColors.primary}15`,
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as 'bold',
    marginBottom: spacing.xs,
    color: lightColors.textPrimary,
  },
  printerAddress: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  printerDetails: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  statusBadge: {
    backgroundColor: lightColors.statusOnline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  statusText: {
    color: lightColors.textOnPrimary,
    fontWeight: typography.fontWeight.bold as 'bold',
    fontSize: typography.fontSize.sm,
  },
  connectText: {
    color: lightColors.primary,
    fontWeight: typography.fontWeight.bold as 'bold',
    fontSize: typography.fontSize.md,
  },
  actions: {
    marginTop: 'auto',
  },
  loadingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.md,
  },
  loadingText: {
    marginLeft: spacing.md,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  printButton: {
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center' as const,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  printButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as 'bold',
  },
  disabledButton: {
    backgroundColor: lightColors.divider,
  },
  cancelButton: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.lg,
    color: lightColors.textSecondary,
  },
});

export default PrinterScreen;
