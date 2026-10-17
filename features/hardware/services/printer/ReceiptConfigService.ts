import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

export interface ReceiptConfig {
  // Header configuration
  header: {
    businessName: string;
    addressLine1: string;
    addressLine2: string;
    phone: string;
    email: string;
    website: string;
    taxId: string;
    logoEnabled: boolean;
  };
  // Footer configuration
  footer: {
    line1: string;
    line2: string;
    line3: string;
    showSocialMedia: boolean;
    facebook: string;
    instagram: string;
    twitter: string;
  };
  // Print options
  options: {
    paperWidth: 58 | 80; // mm - common thermal printer widths
    fontSize: 'small' | 'medium' | 'large';
    printLogo: boolean;
    printBarcode: boolean;
    printQRCode: boolean;
    cutPaper: boolean;
    openCashDrawer: boolean;
    copies: number;
  };
  // Printer model specific settings
  printerModel: {
    type: 'snbc_orient' | 'epson' | 'star' | 'citizen' | 'generic';
    characterWidth: number; // characters per line based on paper width
    supportsBold: boolean;
    supportsUnderline: boolean;
    supportsBarcode: boolean;
    supportsQRCode: boolean;
    supportsCut: boolean;
    supportsCashDrawer: boolean;
  };
}

const RECEIPT_CONFIG_KEY = 'receipt_config';

const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  header: {
    businessName: 'My Business',
    addressLine1: '',
    addressLine2: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    logoEnabled: false,
  },
  footer: {
    line1: 'Thank you for your purchase!',
    line2: 'Please come again',
    line3: '',
    showSocialMedia: false,
    facebook: '',
    instagram: '',
    twitter: '',
  },
  options: {
    paperWidth: 80,
    fontSize: 'medium',
    printLogo: false,
    printBarcode: true,
    printQRCode: false,
    cutPaper: true,
    openCashDrawer: false,
    copies: 1,
  },
  printerModel: {
    type: 'generic',
    characterWidth: 48, // 80mm paper typically has 48 chars
    supportsBold: true,
    supportsUnderline: true,
    supportsBarcode: true,
    supportsQRCode: true,
    supportsCut: true,
    supportsCashDrawer: true,
  },
};

// Printer model presets
const PRINTER_PRESETS: Record<string, Partial<ReceiptConfig['printerModel']>> = {
  snbc_orient: {
    type: 'snbc_orient',
    characterWidth: 48,
    supportsBold: true,
    supportsUnderline: true,
    supportsBarcode: true,
    supportsQRCode: true,
    supportsCut: true,
    supportsCashDrawer: true,
  },
  epson: {
    type: 'epson',
    characterWidth: 48,
    supportsBold: true,
    supportsUnderline: true,
    supportsBarcode: true,
    supportsQRCode: true,
    supportsCut: true,
    supportsCashDrawer: true,
  },
  star: {
    type: 'star',
    characterWidth: 48,
    supportsBold: true,
    supportsUnderline: true,
    supportsBarcode: true,
    supportsQRCode: true,
    supportsCut: true,
    supportsCashDrawer: true,
  },
  citizen: {
    type: 'citizen',
    characterWidth: 42,
    supportsBold: true,
    supportsUnderline: true,
    supportsBarcode: true,
    supportsQRCode: false,
    supportsCut: true,
    supportsCashDrawer: true,
  },
  generic: {
    type: 'generic',
    characterWidth: 32, // Conservative default
    supportsBold: true,
    supportsUnderline: false,
    supportsBarcode: false,
    supportsQRCode: false,
    supportsCut: true,
    supportsCashDrawer: false,
  },
};

export class ReceiptConfigService {
  private static instance: ReceiptConfigService;
  private logger = LoggerFactory.getInstance().createLogger('ReceiptConfigService');
  private config: ReceiptConfig = DEFAULT_RECEIPT_CONFIG;
  private initialized = false;

  private constructor() {}

  static getInstance(): ReceiptConfigService {
    if (!ReceiptConfigService.instance) {
      ReceiptConfigService.instance = new ReceiptConfigService();
    }
    return ReceiptConfigService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const savedConfig = await keyValueRepository.getObject<ReceiptConfig>(RECEIPT_CONFIG_KEY);
      if (savedConfig) {
        this.config = { ...DEFAULT_RECEIPT_CONFIG, ...savedConfig };
      }
      this.initialized = true;
    } catch (error) {
      this.logger.error({ message: 'Failed to load receipt config:' }, error instanceof Error ? error : new Error(String(error)));
      this.config = DEFAULT_RECEIPT_CONFIG;
      this.initialized = true;
    }
  }

  getConfig(): ReceiptConfig {
    return { ...this.config };
  }

  async updateConfig(updates: Partial<ReceiptConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...updates,
      header: { ...this.config.header, ...updates.header },
      footer: { ...this.config.footer, ...updates.footer },
      options: { ...this.config.options, ...updates.options },
      printerModel: { ...this.config.printerModel, ...updates.printerModel },
    };
    await keyValueRepository.setObject(RECEIPT_CONFIG_KEY, this.config);
  }

  async updateHeader(header: Partial<ReceiptConfig['header']>): Promise<void> {
    this.config.header = { ...this.config.header, ...header };
    await keyValueRepository.setObject(RECEIPT_CONFIG_KEY, this.config);
  }

  async updateFooter(footer: Partial<ReceiptConfig['footer']>): Promise<void> {
    this.config.footer = { ...this.config.footer, ...footer };
    await keyValueRepository.setObject(RECEIPT_CONFIG_KEY, this.config);
  }

  async updateOptions(options: Partial<ReceiptConfig['options']>): Promise<void> {
    this.config.options = { ...this.config.options, ...options };
    await keyValueRepository.setObject(RECEIPT_CONFIG_KEY, this.config);
  }

  async setPrinterModel(modelType: keyof typeof PRINTER_PRESETS): Promise<void> {
    const preset = PRINTER_PRESETS[modelType];
    if (preset) {
      this.config.printerModel = {
        ...this.config.printerModel,
        ...preset,
      } as ReceiptConfig['printerModel'];

      // Adjust character width based on paper width
      if (this.config.options.paperWidth === 58) {
        this.config.printerModel.characterWidth = Math.floor(this.config.printerModel.characterWidth * 0.67);
      }

      await keyValueRepository.setObject(RECEIPT_CONFIG_KEY, this.config);
    }
  }

  getCharacterWidth(): number {
    const baseWidth = this.config.printerModel.characterWidth;
    return this.config.options.paperWidth === 58 ? Math.floor(baseWidth * 0.67) : baseWidth;
  }

  getDividerLine(): string {
    return '-'.repeat(this.getCharacterWidth());
  }

  getDoubleDividerLine(): string {
    return '='.repeat(this.getCharacterWidth());
  }

  formatLine(left: string, right: string): string {
    const width = this.getCharacterWidth();
    const maxLeftWidth = width - right.length - 1;
    const truncatedLeft = left.length > maxLeftWidth ? left.substring(0, maxLeftWidth - 3) + '...' : left;
    const padding = width - truncatedLeft.length - right.length;
    return truncatedLeft + ' '.repeat(Math.max(1, padding)) + right;
  }

  centerText(text: string): string {
    const width = this.getCharacterWidth();
    if (text.length >= width) return text.substring(0, width);
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(padding) + text;
  }

  rightAlign(text: string): string {
    const width = this.getCharacterWidth();
    if (text.length >= width) return text.substring(0, width);
    const padding = width - text.length;
    return ' '.repeat(padding) + text;
  }
}

export const receiptConfigService = ReceiptConfigService.getInstance();
