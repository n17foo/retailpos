/**
 * Interface for all scanner services (Bluetooth, USB, etc.)
 */
export interface ScannerServiceInterface {
  /**
   * Connect to the scanner device
   * @param deviceId The ID or address of the scanner device
   * @returns Promise resolving to true if connected successfully, false otherwise
   */
  connect(deviceId: string): Promise<boolean>;

  /**
   * Disconnect from the scanner device
   * @returns Promise resolving when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Check if currently connected to a scanner
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean;

  /**
   * Start listening for barcode scans
   * @param callback Function to call when a barcode is scanned
   * @returns Subscription ID that can be used to stop listening
   */
  startScanListener(callback: (data: string) => void): string;

  /**
   * Stop listening for barcode scans
   * @param subscriptionId Subscription ID returned from startScanListener
   */
  stopScanListener(subscriptionId: string): void;

  /**
   * Discover available scanner devices
   * @returns Promise resolving to list of available devices
   */
  discoverDevices(): Promise<Array<{ id: string; name: string }>>;

  /**
   * Register a callback for unexpected disconnection events.
   * @param callback Called with the device ID (if known) when the connection drops
   * @returns A subscription ID that can be used to unregister
   */
  onDisconnect?(callback: (deviceId?: string) => void): string;

  /**
   * Unregister a previously registered disconnect callback.
   * @param subscriptionId The ID returned from onDisconnect
   */
  offDisconnect?(subscriptionId: string): void;
}
