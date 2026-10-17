import { HidBurstDetector } from './hidBurst';

const config = {
  scanIntervalMs: 80,
  minBarcodeLength: 4,
  maxBarcodeLength: 30,
  suffixChar: 'Enter',
};

/** Types `keys` with `gapMs` between keystrokes and returns per-key results */
function type(d: HidBurstDetector, keys: string[], gapMs: number, start = 0) {
  let t = start;
  return keys.map(key => {
    t += gapMs;
    jest.spyOn(Date, 'now').mockReturnValue(t);
    return { key, ...d.handleKey(key) };
  });
}

describe('HidBurstDetector', () => {
  afterEach(() => jest.restoreAllMocks());

  it('emits a barcode for a fast burst terminated by Enter', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector(config, b => scans.push(b));
    type(d, ['0', '1', '2', '3', '4', '5', 'Enter'], 10);
    expect(scans).toEqual(['012345']);
  });

  it('swallows every burst keystroke after the first, and the terminator', () => {
    const d = new HidBurstDetector(config);
    const results = type(d, ['1', '2', '3', '4', '5', 'Enter'], 10);
    expect(results[0].swallow).toBe(false); // first char indistinguishable from typing
    expect(results.slice(1).every(r => r.swallow)).toBe(true);
  });

  it('does not emit for slow human typing + Enter', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector(config, b => scans.push(b));
    const results = type(d, ['h', 'e', 'l', 'l', 'o', 'Enter'], 300);
    expect(scans).toHaveLength(0);
    expect(results.every(r => !r.swallow)).toBe(true);
  });

  it('respects the minimum barcode length (human Enter passes through)', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector(config, b => scans.push(b));
    const results = type(d, ['a', 'b', 'Enter'], 10);
    expect(scans).toHaveLength(0);
    // 'ab' formed a burst — its Enter terminator is swallowed, but no scan emitted
    expect(results[2].swallow).toBe(true);
  });

  it('respects the maximum barcode length', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector(config, b => scans.push(b));
    type(d, [...'123456789012345678901234567890123', 'Enter'], 10);
    expect(scans).toHaveLength(0);
  });

  it('supports Tab as the suffix terminator', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector({ ...config, suffixChar: 'Tab' }, b => scans.push(b));
    type(d, ['9', '8', '7', '6', '5', 'Tab'], 10);
    expect(scans).toEqual(['98765']);
  });

  it('resets the buffer when the gap exceeds the interval mid-burst', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector(config, b => scans.push(b));
    type(d, ['1', '2', '3'], 10);
    // long pause — burst abandoned — then human typing
    type(d, ['x', 'y', 'Enter'], 200, 5000);
    expect(scans).toHaveLength(0);
  });

  it('handles back-to-back scans in the suppress window', () => {
    const scans: string[] = [];
    const d = new HidBurstDetector(config, b => scans.push(b));
    const first = type(d, ['1', '2', '3', '4', 'Enter'], 10);
    const lastT = 5 * 10;
    const second = type(d, ['9', '8', '7', '6', 'Enter'], 10, lastT + 50);
    expect(scans).toEqual(['1234', '9876']);
    // first char of the second scan is also swallowed (inside suppress window)
    expect(second.every(r => r.swallow)).toBe(true);
    void first;
  });

  it('isBursting reports an in-flight burst only', () => {
    const d = new HidBurstDetector(config);
    type(d, ['1', '2', '3'], 10);
    expect(d.isBursting(30)).toBe(true);
    expect(d.isBursting(500)).toBe(false);
  });
});
