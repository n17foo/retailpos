/**
 * HID barcode-scanner burst detection, shared by the USB (web) and Electron
 * scanner services (docs/specs/system/sales-screen-fast-path-ux.md §4.5.3).
 *
 * HID scanners behave as keyboards that emit a burst of keystrokes at machine
 * speed (typically < 80 ms apart) terminated by Enter/Tab. A human cannot
 * sustain that cadence, so keystrokes inside a burst can be swallowed to keep
 * scanner data out of the omnibar or any other focused input.
 *
 * Pure — no RN, no DOM. `handleKey` is fed `KeyboardEvent.key` values; the
 * caller swallows the DOM event when `swallow` is true. `now` is injectable
 * for tests.
 */

export interface HidBurstConfig {
  /** Max ms between keystrokes considered part of one scan burst */
  scanIntervalMs: number;
  minBarcodeLength: number;
  maxBarcodeLength: number;
  /** Scanner line terminator — 'Enter' or 'Tab' */
  suffixChar: string;
}

export interface HidKeyResult {
  /** True when the key belongs to a scanner burst and must not reach the focused input */
  swallow: boolean;
  /** Completed barcode, when the suffix key closed a valid burst */
  barcode?: string;
}

export class HidBurstDetector {
  private buffer = '';
  private lastKeyTime = 0;
  /** Grace window after a completed scan — scanners often fire back-to-back scans */
  private suppressUntil = 0;

  constructor(
    private config: HidBurstConfig,
    private onScan?: (barcode: string) => void,
    private now: () => number = () => Date.now()
  ) {}

  /**
   * Feed one key event. Returns whether the event should be swallowed and the
   * completed barcode when the burst closed.
   */
  handleKey(key: string): HidKeyResult {
    const now = this.now();
    const gap = now - this.lastKeyTime;
    this.lastKeyTime = now;

    if (key === this.config.suffixChar) {
      const burst = this.buffer;
      this.buffer = '';
      if (burst.length >= this.config.minBarcodeLength && burst.length <= this.config.maxBarcodeLength) {
        const barcode = burst.trim();
        this.suppressUntil = now + this.config.scanIntervalMs * 2;
        this.onScan?.(barcode);
        return { swallow: true, barcode };
      }
      // A partial burst was accumulating — swallow the terminator only when the
      // buffer really is a burst (≥ 2 chars came in at scanner speed). A single
      // buffered char is just the last human keystroke — the Enter is theirs.
      return { swallow: burst.length >= 2 };
    }

    if (key.length !== 1) {
      return { swallow: false };
    }

    if (this.buffer.length > 0 && gap <= this.config.scanIntervalMs) {
      // Continuation of an in-flight burst — definitely the scanner
      this.buffer += key;
      return { swallow: true };
    }

    if (this.buffer.length === 0 && now <= this.suppressUntil) {
      // Immediately after a scan a new burst may start — swallow its first chars
      this.buffer = key;
      return { swallow: true };
    }

    // First keystroke of a possible burst. It is indistinguishable from human
    // typing until the next key arrives, so it passes through; if a burst
    // follows, subsequent keys (and the terminator) are still swallowed.
    this.buffer = gap > this.config.scanIntervalMs ? key : this.buffer + key;
    return { swallow: false };
  }

  /** True while a burst is in flight — inputs use this to reject buffered chars */
  isBursting(now: number = this.now()): boolean {
    return this.buffer.length > 0 && now - this.lastKeyTime <= this.config.scanIntervalMs;
  }

  reset(): void {
    this.buffer = '';
    this.lastKeyTime = 0;
    this.suppressUntil = 0;
  }
}
