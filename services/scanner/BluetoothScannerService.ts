import { ScannerServiceInterface } from './ScannerServiceInterface';
import { BleManager, Device } from 'react-native-ble-plx';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Bluetooth scanner service implementation using BLE
 */
export class BluetoothScannerService implements ScannerServiceInterface {
  private bleManager: BleManager;
  private connectedDevice: Device | null = null;
  private scanListeners: Map<string, (data: string) => void> = new Map();
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  constructor() {
    this.bleManager = new BleManager();
    this.logger = LoggerFactory.getInstance().createLogger('BluetoothScannerService');
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

      return true;
    } catch (error) {
      this.logger.error({ message: 'Error connecting to Bluetooth device' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Disconnect from currently connected Bluetooth scanner
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connectedDevice) {
        await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
        this.connectedDevice = null;
        this.logger.info('Disconnected from Bluetooth scanner');
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
      // Get the service and characteristic for barcode data
      // Note: These UUIDs will need to be adjusted for your specific scanner
      const serviceUUID = '49535343-FE7D-4AE5-8FA9-9FAFD205E455';
      const characteristicUUID = '49535343-8841-43F4-A8D4-ECBE34729BB3';

      // Subscribe to notifications on the barcode data characteristic
      const subscriptionId = `${this.connectedDevice.id}-${Date.now()}`;

      this.connectedDevice.monitorCharacteristicForService(serviceUUID, characteristicUUID, (error, characteristic) => {
        if (error) {
          this.logger.error({ message: 'Error reading barcode data' }, error instanceof Error ? error : new Error(String(error)));
          return;
        }

        if (characteristic?.value) {
          // Decode the base64 value to get the barcode text
          const buffer = Buffer.from(characteristic.value, 'base64');
          const barcodeData = buffer.toString('utf8');

          // Call the callback with the barcode data
          callback(barcodeData);
        }
      });

      // Store the callback for later cleanup
      this.scanListeners.set(subscriptionId, callback);

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
    if (this.scanListeners.has(subscriptionId)) {
      this.scanListeners.delete(subscriptionId);
      // The actual BLE notification will be automatically unsubscribed when disconnecting
    }
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
              // Filter for devices that look like scanners
              if (
                device.name.toLowerCase().includes('scanner') ||
                device.name.toLowerCase().includes('barcode') ||
                device.name.toLowerCase().includes('reader')
              ) {
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
