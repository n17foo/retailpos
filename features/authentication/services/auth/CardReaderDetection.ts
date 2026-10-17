import { ElectronWindow } from '../../../../shared/utils/electron';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

/**
 * Known USB HID card reader vendor IDs
 */
export const CARD_READER_VENDORS = {
  MAGTEK: { vendorId: 0x0801, name: 'MagTek' },
  ID_TECH: { vendorId: 0x0c27, name: 'ID TECH' },
  CHERRY: { vendorId: 0x046a, name: 'Cherry' },
  HID_GLOBAL: { vendorId: 0x076b, name: 'HID Global' },
  GEMALTO: { vendorId: 0x08e6, name: 'Gemalto' },
  IDENTIV: { vendorId: 0x04e6, name: 'Identiv' },
} as const;

export interface DetectedCardReader {
  deviceId: string;
  vendorId: number;
  productId: number;
  vendorName: string;
  productName?: string;
  serialNumber?: string;
}

/**
 * Card Reader Detection Service
 *
 * Auto-detects USB HID card readers on Electron platform.
 * Supports common vendors: MagTek, ID TECH, Cherry, HID Global, etc.
 */
export class CardReaderDetection {
  private static instance: CardReaderDetection;
  private logger = LoggerFactory.getInstance().createLogger('CardReaderDetection');
  private detectedReaders: Map<string, DetectedCardReader> = new Map();

  private constructor() {}

  static getInstance(): CardReaderDetection {
    if (!CardReaderDetection.instance) {
      CardReaderDetection.instance = new CardReaderDetection();
    }
    return CardReaderDetection.instance;
  }

  /**
   * Detect USB HID card readers (Electron only)
   * @returns Array of detected card readers
   */
  async detectReaders(): Promise<DetectedCardReader[]> {
    this.detectedReaders.clear();

    try {
      // Check if running on Electron
      if (typeof window === 'undefined' || !(window as ElectronWindow).isElectron) {
        this.logger.info('Card reader detection only available on Electron');
        return [];
      }

      // Get HID devices from Electron
      const devices = await this.getElectronHIDDevices();

      // Filter for known card reader vendors
      for (const device of devices) {
        const vendor = this.identifyVendor(device.vendorId);
        if (vendor) {
          const reader: DetectedCardReader = {
            deviceId: device.deviceId || `${device.vendorId}-${device.productId}`,
            vendorId: device.vendorId,
            productId: device.productId,
            vendorName: vendor.name,
            productName: device.productName,
            serialNumber: device.serialNumber,
          };

          this.detectedReaders.set(reader.deviceId, reader);
          this.logger.info(`Detected card reader: ${reader.vendorName} (${reader.deviceId})`);
        }
      }

      return Array.from(this.detectedReaders.values());
    } catch (error) {
      this.logger.error({ message: 'Failed to detect card readers' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Get HID devices from Electron
   * @private
   */
  private async getElectronHIDDevices(): Promise<
    Array<{
      deviceId?: string;
      vendorId: number;
      productId: number;
      productName?: string;
      serialNumber?: string;
    }>
  > {
    try {
      // Call Electron IPC to get HID devices
      const electron = (window as Window & { electron?: { getHIDDevices?: () => Promise<unknown[]> } }).electron;
      if (electron?.getHIDDevices) {
        return (await electron.getHIDDevices()) as Array<{
          deviceId?: string;
          vendorId: number;
          productId: number;
          productName?: string;
          serialNumber?: string;
        }>;
      }
      return [];
    } catch (error) {
      this.logger.error({ message: 'Failed to get HID devices from Electron' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Identify vendor by vendor ID
   * @private
   */
  private identifyVendor(vendorId: number): { vendorId: number; name: string } | null {
    for (const vendor of Object.values(CARD_READER_VENDORS)) {
      if (vendor.vendorId === vendorId) {
        return vendor;
      }
    }
    return null;
  }

  /**
   * Get list of detected card readers
   */
  getDetectedReaders(): DetectedCardReader[] {
    return Array.from(this.detectedReaders.values());
  }

  /**
   * Check if any card readers are detected
   */
  hasDetectedReaders(): boolean {
    return this.detectedReaders.size > 0;
  }

  /**
   * Parse magnetic stripe track data
   * Supports Track 1 and Track 2 formats
   */
  parseMagstripeData(raw: string): {
    track: 1 | 2 | null;
    cardNumber?: string;
    name?: string;
    expiryDate?: string;
  } | null {
    try {
      // Track 2 format: ;1234567890123456=2512101?
      const track2Match = raw.match(/;(\d+)=(\d{4})/);
      if (track2Match) {
        return {
          track: 2,
          cardNumber: track2Match[1],
          expiryDate: track2Match[2], // YYMM format
        };
      }

      // Track 1 format: %B1234567890123456^LASTNAME/FIRSTNAME^2512101?
      const track1Match = raw.match(/%B(\d+)\^([^^]+)\^(\d{4})/);
      if (track1Match) {
        return {
          track: 1,
          cardNumber: track1Match[1],
          name: track1Match[2],
          expiryDate: track1Match[3], // YYMM format
        };
      }

      // No valid track data found
      return null;
    } catch (error) {
      this.logger.error({ message: 'Failed to parse magstripe data' }, error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Validate card number using Luhn algorithm
   */
  validateCardNumber(cardNumber: string): boolean {
    // Remove non-digits
    const digits = cardNumber.replace(/\D/g, '');

    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Extract employee ID from card data
   * This is a simple implementation - customize based on your card format
   */
  extractEmployeeId(cardData: string): string | null {
    const parsed = this.parseMagstripeData(cardData);
    if (!parsed) {
      // If not standard track format, return trimmed raw data
      return cardData.trim() || null;
    }

    // Use card number as employee ID
    return parsed.cardNumber || null;
  }
}

export const cardReaderDetection = CardReaderDetection.getInstance();
