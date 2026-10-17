import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { ScannerServiceInterface } from './ScannerServiceInterface';
import { scannerSettingsService } from './ScannerSettingsService';
import { getElectronAPI } from '../../../../shared/utils/electron';
import { HidBurstDetector } from '../../../scanning/utils/hidBurst';

/**
 * Electron-specific barcode / QR scanner service.
 *
 * On desktop, USB and Bluetooth barcode scanners behave as HID keyboard devices.
 * They emit rapid keystrokes terminated by Enter. This service captures those
 * keystrokes using two complementary strategies:
 *
 *  1. **DOM `keydown` listener** — works in the renderer process for any HID
 *     scanner that the OS recognises as a keyboard. This is the most common
 *     case and requires zero native code.
 *
 *  2. **Electron IPC `onBarcodeScan`** — the main process can optionally
 *     monitor raw HID input (via `node-hid` or similar) and forward complete
 *     scan strings to the renderer. This handles edge-cases where the OS
 *     doesn't map the scanner to a keyboard (e.g. some serial-profile BT
 *     scanners).
 *
 * Both strategies feed into the same `scanListeners` map so callers get a
 * unified callback regardless of input source.
 */
export class ElectronScannerService implements ScannerServiceInterface {
  private connected = false;
  private deviceId: string | null = null;
  private scanListeners: Map<string, (data: string) => void> = new Map();
  private logger = LoggerFactory.getInstance().createLogger('ElectronScannerService');

  // DOM keydown state — shared HID burst detector driven by scanner settings
  private burstDetector: HidBurstDetector | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Electron IPC unsubscribe function
  private ipcUnsubscribe: (() => void) | null = null;

  async connect(deviceId: string = 'electron-hid'): Promise<boolean> {
    try {
      this.deviceId = deviceId;
      this.connected = true;
      this.burstDetector = null;

      this.logger.info(`Electron scanner connected: ${deviceId}`);
      return true;
    } catch (error) {
      this.logger.error({ message: 'Error connecting Electron scanner' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.removeKeydownListener();
    this.removeIpcListener();
    this.scanListeners.clear();
    this.connected = false;
    this.deviceId = null;
    this.burstDetector = null;
    this.logger.info('Electron scanner disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Start listening for barcode scans.
   * Attaches the DOM keydown listener (once) and the IPC listener (once).
   */
  startScanListener(callback: (data: string) => void): string {
    if (!this.connected) {
      this.logger.error('Cannot start scan listener: not connected');
      return '';
    }

    const subscriptionId = `electron-${this.deviceId}-${Date.now()}`;
    this.scanListeners.set(subscriptionId, callback);

    // Attach DOM listener if not already active
    if (!this.keydownHandler && typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
      window.addEventListener('keydown', this.keydownHandler, true);
      this.logger.info('DOM keydown listener attached for HID scanner input');
    }

    // Attach IPC listener if available and not already active
    if (!this.ipcUnsubscribe) {
      const api = getElectronAPI();
      if (api?.onBarcodeScan) {
        this.ipcUnsubscribe = api.onBarcodeScan((data: string) => {
          this.emitScan(data);
        });
        this.logger.info('IPC barcode scan listener attached');
      }
    }

    return subscriptionId;
  }

  stopScanListener(subscriptionId: string): void {
    this.scanListeners.delete(subscriptionId);

    // If no more listeners, clean up
    if (this.scanListeners.size === 0) {
      this.removeKeydownListener();
      this.removeIpcListener();
    }
  }

  /**
   * Discover available scanner devices.
   * On Electron, queries the main process for connected HID devices.
   * Falls back to a logical HID device if enumeration is not available.
   */
  async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    try {
      const api = getElectronAPI();
      if (api?.scannerDiscover) {
        this.logger.info('Discovering scanner devices via Electron IPC');
        const devices = await api.scannerDiscover();
        if (devices && devices.length > 0) {
          this.logger.info(`Found ${devices.length} scanner devices`);
          return devices;
        }
      }

      // Fallback: Return logical HID device
      this.logger.info('Using default HID scanner device');
      return [{ id: 'electron-hid', name: 'USB / Bluetooth HID Scanner (Desktop)' }];
    } catch (error) {
      this.logger.error({ message: 'Error discovering scanner devices' }, error instanceof Error ? error : new Error(String(error)));
      return [{ id: 'electron-hid', name: 'USB / Bluetooth HID Scanner (Desktop)' }];
    }
  }

  // ── Internal helpers ─────────────────────────────────────────

  private handleKeydown(e: KeyboardEvent): void {
    if (!this.burstDetector) {
      // HID burst detection shares the configured USB scanner settings — on
      // desktop, HID scanners are the same keyboard-emulation devices.
      this.burstDetector = new HidBurstDetector(scannerSettingsService.getUsbConfig(), barcode => this.emitScan(barcode));
    }
    const result = this.burstDetector.handleKey(e.key);
    if (result.swallow) {
      // Scanner burst — keep the keystroke out of the omnibar / focused inputs
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private emitScan(data: string): void {
    if (!data) return;
    this.logger.info(`Barcode scanned: ${data}`);
    this.scanListeners.forEach(cb => cb(data));
  }

  private removeKeydownListener(): void {
    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler, true);
      this.keydownHandler = null;
    }
  }

  private removeIpcListener(): void {
    if (this.ipcUnsubscribe) {
      this.ipcUnsubscribe();
      this.ipcUnsubscribe = null;
    }
  }
}
