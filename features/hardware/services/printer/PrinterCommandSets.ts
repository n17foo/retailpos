/**
 * Printer Command Sets
 *
 * Different printer manufacturers use different ESC/POS command sets.
 * This module provides command definitions for various printer models.
 */

export type PrinterCommandSet = 'epson' | 'star' | 'citizen' | 'generic';

export interface PrinterCommands {
  INIT: number[];
  CUT: number[];
  DRAWER_KICK_PIN2: number[];
  DRAWER_KICK_PIN5: number[];
  FEED: number[];
  ALIGN_CENTER: number[];
  ALIGN_LEFT: number[];
  ALIGN_RIGHT: number[];
  BOLD_ON: number[];
  BOLD_OFF: number[];
  DOUBLE_HEIGHT: number[];
  NORMAL_SIZE: number[];
  FONT_A: number[];
  FONT_B: number[];
  NEWLINE: number[];
  QR_CODE?: (data: string) => number[];
  BARCODE_CODE128?: (data: string) => number[];
}

/**
 * Epson ESC/POS commands (most common, used by Epson TM-series)
 */
export const EPSON_COMMANDS: PrinterCommands = {
  INIT: [0x1b, 0x40],
  CUT: [0x1d, 0x56, 0x41, 0x10],
  DRAWER_KICK_PIN2: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  DRAWER_KICK_PIN5: [0x1b, 0x70, 0x01, 0x19, 0xfa],
  FEED: [0x1b, 0x64, 0x10],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  DOUBLE_HEIGHT: [0x1b, 0x21, 0x10],
  NORMAL_SIZE: [0x1b, 0x21, 0x00],
  FONT_A: [0x1b, 0x4d, 0x00],
  FONT_B: [0x1b, 0x4d, 0x01],
  NEWLINE: [0x0a],
  QR_CODE: (data: string) => {
    const bytes = new TextEncoder().encode(data);
    const len = bytes.length;
    return [
      0x1d,
      0x28,
      0x6b,
      0x04,
      0x00,
      0x31,
      0x41,
      0x32,
      0x00, // QR model
      0x1d,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x43,
      0x08, // QR size
      0x1d,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x45,
      0x30, // QR error correction
      0x1d,
      0x28,
      0x6b,
      len + 3,
      0x00,
      0x31,
      0x50,
      0x30,
      ...Array.from(bytes), // QR data
      0x1d,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x51,
      0x30, // Print QR
    ];
  },
  BARCODE_CODE128: (data: string) => {
    const bytes = new TextEncoder().encode(data);
    return [
      0x1d,
      0x68,
      0x50, // Barcode height
      0x1d,
      0x77,
      0x02, // Barcode width
      0x1d,
      0x48,
      0x02, // HRI position (below)
      0x1d,
      0x6b,
      0x49,
      bytes.length,
      ...Array.from(bytes), // CODE128
    ];
  },
};

/**
 * Star Micronics commands (used by Star TSP series)
 * Star printers use different commands for some operations
 */
export const STAR_COMMANDS: PrinterCommands = {
  INIT: [0x1b, 0x40],
  CUT: [0x1b, 0x64, 0x03], // Star uses different cut command
  DRAWER_KICK_PIN2: [0x1b, 0x07, 0x07, 0x07, 0x07, 0x07], // Star drawer kick
  DRAWER_KICK_PIN5: [0x1b, 0x07, 0x07, 0x07, 0x07, 0x07], // Same for Star
  FEED: [0x1b, 0x64, 0x10],
  ALIGN_CENTER: [0x1b, 0x1d, 0x61, 0x01],
  ALIGN_LEFT: [0x1b, 0x1d, 0x61, 0x00],
  ALIGN_RIGHT: [0x1b, 0x1d, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45],
  BOLD_OFF: [0x1b, 0x46],
  DOUBLE_HEIGHT: [0x1b, 0x69, 0x01, 0x01],
  NORMAL_SIZE: [0x1b, 0x69, 0x00, 0x00],
  FONT_A: [0x1b, 0x1e, 0x46, 0x00],
  FONT_B: [0x1b, 0x1e, 0x46, 0x01],
  NEWLINE: [0x0a],
  QR_CODE: (data: string) => {
    const bytes = new TextEncoder().encode(data);
    const len = bytes.length;
    return [
      0x1b,
      0x1d,
      0x79,
      0x53,
      0x30,
      0x02, // QR model
      0x1b,
      0x1d,
      0x79,
      0x53,
      0x32,
      0x08, // QR size
      0x1b,
      0x1d,
      0x79,
      0x53,
      0x31,
      0x00, // QR error correction
      0x1b,
      0x1d,
      0x79,
      0x44,
      0x31,
      0x00,
      len & 0xff,
      (len >> 8) & 0xff,
      ...Array.from(bytes), // QR data
      0x1b,
      0x1d,
      0x79,
      0x50, // Print QR
    ];
  },
  BARCODE_CODE128: (data: string) => {
    const bytes = new TextEncoder().encode(data);
    return [
      0x1b,
      0x62,
      0x06,
      0x02,
      0x02,
      bytes.length,
      ...Array.from(bytes),
      0x1e, // Star barcode
    ];
  },
};

/**
 * Citizen commands (used by Citizen CT-S series)
 * Similar to Epson but with some variations
 */
export const CITIZEN_COMMANDS: PrinterCommands = {
  INIT: [0x1b, 0x40],
  CUT: [0x1b, 0x69],
  DRAWER_KICK_PIN2: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  DRAWER_KICK_PIN5: [0x1b, 0x70, 0x01, 0x19, 0xfa],
  FEED: [0x1b, 0x64, 0x10],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  DOUBLE_HEIGHT: [0x1b, 0x21, 0x10],
  NORMAL_SIZE: [0x1b, 0x21, 0x00],
  FONT_A: [0x1b, 0x4d, 0x00],
  FONT_B: [0x1b, 0x4d, 0x01],
  NEWLINE: [0x0a],
  QR_CODE: EPSON_COMMANDS.QR_CODE, // Citizen uses Epson-compatible QR
  BARCODE_CODE128: EPSON_COMMANDS.BARCODE_CODE128,
};

/**
 * Generic commands (safe fallback for unknown printers)
 * Uses most common ESC/POS commands
 */
export const GENERIC_COMMANDS: PrinterCommands = {
  INIT: [0x1b, 0x40],
  CUT: [0x1d, 0x56, 0x00],
  DRAWER_KICK_PIN2: [0x1b, 0x70, 0x00, 0x19, 0xfa],
  DRAWER_KICK_PIN5: [0x1b, 0x70, 0x01, 0x19, 0xfa],
  FEED: [0x1b, 0x64, 0x10],
  ALIGN_CENTER: [0x1b, 0x61, 0x01],
  ALIGN_LEFT: [0x1b, 0x61, 0x00],
  ALIGN_RIGHT: [0x1b, 0x61, 0x02],
  BOLD_ON: [0x1b, 0x45, 0x01],
  BOLD_OFF: [0x1b, 0x45, 0x00],
  DOUBLE_HEIGHT: [0x1b, 0x21, 0x10],
  NORMAL_SIZE: [0x1b, 0x21, 0x00],
  FONT_A: [0x1b, 0x4d, 0x00],
  FONT_B: [0x1b, 0x4d, 0x01],
  NEWLINE: [0x0a],
};

/**
 * Get command set for a specific printer model
 */
export function getCommandSet(commandSet: PrinterCommandSet): PrinterCommands {
  switch (commandSet) {
    case 'epson':
      return EPSON_COMMANDS;
    case 'star':
      return STAR_COMMANDS;
    case 'citizen':
      return CITIZEN_COMMANDS;
    case 'generic':
    default:
      return GENERIC_COMMANDS;
  }
}

/**
 * Map printer model names to command sets
 */
export function getCommandSetForModel(model: string): PrinterCommandSet {
  const modelLower = model.toLowerCase();

  if (modelLower.includes('star') || modelLower.includes('tsp')) {
    return 'star';
  }
  if (modelLower.includes('citizen') || modelLower.includes('ct-s')) {
    return 'citizen';
  }
  if (modelLower.includes('epson') || modelLower.includes('tm-')) {
    return 'epson';
  }

  return 'generic';
}
