# RetailPOS Printer Service Architecture

## Updated Printer Implementation

The RetailPOS system now uses a unified printer service implementation that follows the factory pattern used throughout the application. This approach consolidates multiple printer types (USB, Bluetooth, Network) into a single consistent API.

## Architecture

The printer service architecture consists of:

1. **UnifiedPrinterService**: A single service that supports all printer types through the `@tillpos/rn-receipt-printer-utils` library
2. **PrinterServiceFactory**: Factory that manages printer instances and provides a clean API for the rest of the application
3. **BasePrinterService**: Abstract interface that defines the core printer functionality
4. **PrinterTypes**: Common type definitions used across the printer services

## Migration

Previous implementation used separate services for each printer type:

- USBPrinterService (using react-native-usb-printer)
- BluetoothPrinterService (using react-native-bluetooth-escpos-printer)
- NetworkPrinterService (using react-native-thermal-receipt-printer)

These services have been deprecated and replaced with the UnifiedPrinterService. The old services are kept for reference but marked as deprecated.

## Usage

The printer service should be accessed through the factory:

```typescript
// Get the printer service factory instance
const printerFactory = PrinterServiceFactory.getInstance();

// Connect to a printer
await printerFactory.connectToPrinter('Epson TM-T88VI');

// Print a receipt
await printerFactory.printReceipt({
  orderId: 'ORD-123',
  date: new Date(),
  cashierName: 'John Doe',
  items: [...],
  subtotal: 100,
  tax: 10,
  total: 110,
  paymentMethod: 'Credit Card'
});

// Disconnect from the printer
await printerFactory.disconnect();
```

## Settings Integration

The printer configuration can be managed through the settings screen, which allows users to:

1. Select printer connection type (USB, Bluetooth, Network)
2. Configure printer-specific settings
3. Test printer connections

## Benefits

This unified approach provides several benefits:

1. **Simplified Dependency Management**: One library instead of three separate ones
2. **Consistent API**: Same interface for all printer types
3. **Improved Error Handling**: Standardized error handling across all printer types
4. **Better Maintainability**: Less code duplication and easier to add new features
5. **Aligned with System Architecture**: Follows the factory pattern used throughout RetailPOS
