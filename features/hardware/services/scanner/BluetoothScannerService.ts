import { ScannerServiceInterface } from './ScannerServiceInterface';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { decodeBase64 } from '../../../../shared/utils/base64';
import { scannerSettingsService } from './ScannerSettingsService';

/**
 * Bluetooth scanner service implementation using BLE
 */
export class BluetoothScannerService implements ScannerServiceInterface {
  readonly driverType = 'bluetooth' as const;
  private bleManager: BleManager;
  private connectedDevice: Device | null = null;
  private scanListeners: Map<string, (data: string) => void> = new Map();
  private bleSubscriptions: Map<string, Subscription> = new Map();
  private serviceUUID: string = '';
  private characteristicUUID: string = '';
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  constructor() {
    this.bleManager = new BleManager();
    this.logger = LoggerFactory.getInstance().createLogger('BluetoothScannerService');

    // Load UUIDs from settings service
    const config = scannerSettingsService.getBluetoothConfig();
    this.serviceUUID = config.serviceUUID;
    this.characteristicUUID = config.characteristicUUID;
  }

  /**
   * Configure BLE GATT UUIDs for the barcode data characteristic.
   * Call this after loading scanner settings and before connect().
   * @param serviceUUID GATT service UUID
   * @param characteristicUUID GATT characteristic UUID for barcode data
   */
  configure(serviceUUID: string, characteristicUUID: string): void {
    this.serviceUUID = serviceUUID;
    this.characteristicUUID = characteristicUUID;
    this.logger.info(`BLE UUIDs configured: service=${this.serviceUUID} char=${this.characteristicUUID}`);
  }

  /**
   * Connect to a Bluetooth scanner device
   * @param deviceId The Bluetooth device ID to connect to
   * @returns Promise resolving to true if connected successfully
   */
  async connect(deviceId: string): Promise<boolean> {
    try {
      // Check if Bluetooth is powered on
      const state = await this.bleManager.state();
      if (state !== 'PoweredOn') {
        this.logger.warn('Bluetooth is not powered on');
        return false;
      }

      // Connect to the device
      const device = await this.bleManager.connectToDevice(deviceId);
      this.logger.info(`Connected to device: ${device.id}`);

      // Discover services and characteristics
      await device.discoverAllServicesAndCharacteristics();

      // Store the connected device
      this.connectedDevice = device;

      // Audit log the connection
      const { auditLogService } = await import('../../../../shared/services/audit/AuditLogService');
      await auditLogService.log('hardware:connected', {
        details: `BLE scanner connected: ${device.name || deviceId}`,
        metadata: { deviceType: 'scanner', connectionType: 'bluetooth', deviceId, deviceName: device.name },
      });

      return true;
    } catch (error) {
      this.logger.error({ message: 'Error connecting to Bluetooth device' }, error instanceof Error ? error : new Error(String(error)));

      // Audit log the error
      const { auditLogService } = await import('../../../../shared/services/audit/AuditLogService');
      await auditLogService.log('hardware:error', {
        details: `Failed to connect BLE scanner: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { deviceType: 'scanner', connectionType: 'bluetooth', deviceId },
      });

      return false;
    }
  }

  /**
   * Disconnect from currently connected Bluetooth scanner
   */
  async disconnect(): Promise<void> {
    try {
      // Cancel all active BLE subscriptions before disconnecting
      for (const [id, sub] of this.bleSubscriptions.entries()) {
        sub.remove();
        this.bleSubscriptions.delete(id);
      }
      this.scanListeners.clear();

      if (this.connectedDevice) {
        const deviceId = this.connectedDevice.id;
        const deviceName = this.connectedDevice.name;

        await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
        this.connectedDevice = null;
        this.logger.info('Disconnected from Bluetooth scanner');

        // Audit log the disconnection
        const { auditLogService } = await import('../../../../shared/services/audit/AuditLogService');
        await auditLogService.log('hardware:disconnected', {
          details: `BLE scanner disconnected: ${deviceName || deviceId}`,
          metadata: { deviceType: 'scanner', connectionType: 'bluetooth', deviceId, deviceName },
        });
      }
    } catch (error) {
      this.logger.error(
        { message: 'Error disconnecting from Bluetooth device' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if connected to a Bluetooth scanner
   */
  isConnected(): boolean {
    return this.connectedDevice !== null;
  }

  /**
   * Start listening for barcode scans from the connected Bluetooth device
   * @param callback Function to call when barcode data is received
   * @returns Subscription ID
   */
  startScanListener(callback: (data: string) => void): string {
    if (!this.connectedDevice) {
      this.logger.error('Cannot start scan listener: No device connected');
      return '';
    }

    try {
      // Subscribe to notifications on the barcode data characteristic
      // UUIDs are set via configure() — defaults to Microchip RN4020 serial profile
      const subscriptionId = `${this.connectedDevice.id}-${Date.now()}`;

      const bleSub = this.connectedDevice.monitorCharacteristicForService(
        this.serviceUUID,
        this.characteristicUUID,
        (error, characteristic) => {
          if (error) {
            this.logger.error({ message: 'Error reading barcode data' }, error instanceof Error ? error : new Error(String(error)));
            return;
          }

          if (characteristic?.value) {
            // Decode the base64 value to get the barcode text
            const barcodeData = decodeBase64(characteristic.value);

            // Call the callback with the barcode data
            callback(barcodeData);
          }
        }
      );

      // Store both the callback and the BLE subscription object for proper cleanup
      this.scanListeners.set(subscriptionId, callback);
      this.bleSubscriptions.set(subscriptionId, bleSub);

      return subscriptionId;
    } catch (error) {
      this.logger.error({ message: 'Error starting scan listener' }, error instanceof Error ? error : new Error(String(error)));
      return '';
    }
  }

  /**
   * Stop listening for barcode scans
   * @param subscriptionId The subscription ID returned from startScanListener
   */
  stopScanListener(subscriptionId: string): void {
    if (this.bleSubscriptions.has(subscriptionId)) {
      this.bleSubscriptions.get(subscriptionId)!.remove();
      this.bleSubscriptions.delete(subscriptionId);
    }
    this.scanListeners.delete(subscriptionId);
  }

  /**
   * Discover available Bluetooth scanner devices
   * @returns Promise resolving to array of available devices
   */
  async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    try {
      const devices: Array<{ id: string; name: string }> = [];

      // Scan for Bluetooth devices
      await new Promise<void>((resolve, reject) => {
        const scanTimeout = setTimeout(() => {
          this.bleManager.stopDeviceScan();
          resolve();
        }, 5000); // Scan for 5 seconds

        this.bleManager.startDeviceScan(
          null, // Scan for all services
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              clearTimeout(scanTimeout);
              this.bleManager.stopDeviceScan();
              reject(error);
              return;
            }

            if (device && device.name) {
              // Filter using configured device name patterns
              if (scannerSettingsService.matchesDevicePattern(device.name)) {
                devices.push({
                  id: device.id,
                  name: device.name,
                });
              }
            }
          }
        );
      });

      return devices;
    } catch (error) {
      this.logger.error({ message: 'Error discovering Bluetooth devices' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
}
