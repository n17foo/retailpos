import { LoggerFactory } from '../logger/LoggerFactory';
import { ScannerServiceInterface } from './ScannerServiceInterface';
import { getElectronAPI } from '../../utils/electron';

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

  // DOM keydown state
  private inputBuffer = '';
  private lastKeyTime = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Electron IPC unsubscribe function
  private ipcUnsubscribe: (() => void) | null = null;

  /**
   * Maximum milliseconds between keystrokes to consider them part of the
   * same scan. Real scanners type at 10-50 ms intervals; a human can't
   * sustain < 80 ms between keys.
   */
  private static readonly SCAN_INTERVAL_MS = 80;

  /**
   * Minimum characters for a valid barcode (filters accidental Enter presses).
   */
  private static readonly MIN_BARCODE_LENGTH = 3;

  async connect(deviceId: string = 'electron-hid'): Promise<boolean> {
    try {
      this.deviceId = deviceId;
      this.connected = true;
      this.inputBuffer = '';
      this.lastKeyTime = 0;

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
    this.inputBuffer = '';
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
   * On Electron, HID scanners don't need discovery — they're keyboards.
   * Returns a single logical device representing the HID input channel.
   */
  async discoverDevices(): Promise<Array<{ id: string; name: string }>> {
    return [{ id: 'electron-hid', name: 'USB / Bluetooth HID Scanner (Desktop)' }];
  }

  // ── Internal helpers ─────────────────────────────────────────

  private handleKeydown(e: KeyboardEvent): void {
    const now = Date.now();

    // If too much time has elapsed since the last keystroke, reset the buffer
    // (this means the previous sequence was human typing, not a scanner)
    if (now - this.lastKeyTime > ElectronScannerService.SCAN_INTERVAL_MS && this.inputBuffer.length > 0) {
      this.inputBuffer = '';
    }

    this.lastKeyTime = now;

    if (e.key === 'Enter') {
      if (this.inputBuffer.length >= ElectronScannerService.MIN_BARCODE_LENGTH) {
        const barcode = this.inputBuffer.trim();
        this.inputBuffer = '';
        this.emitScan(barcode);
      } else {
        // Too short — likely a human pressing Enter in a form field
        this.inputBuffer = '';
      }
      return;
    }

    // Only accumulate printable single characters
    if (e.key.length === 1) {
      this.inputBuffer += e.key;
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
