/**
 * useResponsive — pure function tests
 *
 * getProductColumns() and getSaleLayout() are exported pure functions
 * with no React or RN dependencies — tested directly.
 */

import { getProductColumns, getSaleLayout, getSaleLayoutClass, breakpoints } from './responsive.utils';

// ── getProductColumns ─────────────────────────────────────────────────────

describe('getProductColumns', () => {
  it('returns 2 columns on mobile (< 768)', () => {
    expect(getProductColumns(320)).toBe(2);
    expect(getProductColumns(767)).toBe(2);
  });

  it('returns 3 columns on tablet (768–1023)', () => {
    expect(getProductColumns(768)).toBe(3);
    expect(getProductColumns(1023)).toBe(3);
  });

  it('returns 4 columns on desktop (1024–1439)', () => {
    expect(getProductColumns(1024)).toBe(4);
    expect(getProductColumns(1439)).toBe(4);
  });

  it('returns 5 columns on wide screens (>= 1440)', () => {
    expect(getProductColumns(1440)).toBe(5);
    expect(getProductColumns(2560)).toBe(5);
  });

  it('returns correct columns at exact breakpoint boundaries', () => {
    expect(getProductColumns(breakpoints.tablet)).toBe(3);
    expect(getProductColumns(breakpoints.desktop)).toBe(4);
    expect(getProductColumns(breakpoints.wide)).toBe(5);
  });
});

// ── getSaleLayoutClass (spec §4.8.1) ──────────────────────────────────────

describe('getSaleLayoutClass', () => {
  it('uses the stacked phone shell below 600px width', () => {
    expect(getSaleLayoutClass(360, 640)).toBe('phone');
    expect(getSaleLayoutClass(390, 844)).toBe('phone');
    expect(getSaleLayoutClass(599, 800)).toBe('phone');
  });

  it('uses the phone shell below 768px when portrait', () => {
    expect(getSaleLayoutClass(700, 1000)).toBe('phone'); // narrow portrait window / Slide Over
    expect(getSaleLayoutClass(320, 1024)).toBe('phone'); // iPad Slide Over
    expect(getSaleLayoutClass(507, 1024)).toBe('phone'); // iPad split view
  });

  it('uses phone-landscape when height < 500 and width >= 568', () => {
    expect(getSaleLayoutClass(844, 390)).toBe('phone-landscape');
    expect(getSaleLayoutClass(568, 320)).toBe('phone-landscape');
  });

  it('does not use phone-landscape below 568px width', () => {
    expect(getSaleLayoutClass(567, 320)).toBe('phone');
  });

  it('uses tablet for 768–1023px with normal height', () => {
    expect(getSaleLayoutClass(768, 1024)).toBe('tablet');
    expect(getSaleLayoutClass(1023, 768)).toBe('tablet');
  });

  it('uses desktop for 1024–1439px', () => {
    expect(getSaleLayoutClass(1024, 768)).toBe('desktop');
    expect(getSaleLayoutClass(1194, 834)).toBe('desktop'); // iPad landscape
    expect(getSaleLayoutClass(1280, 720)).toBe('desktop');
  });

  it('uses wide at 1440px and above', () => {
    expect(getSaleLayoutClass(1440, 900)).toBe('wide');
    expect(getSaleLayoutClass(1920, 1080)).toBe('wide');
  });

  it('covers the spec device matrix', () => {
    const cases: Array<[number, number, string]> = [
      [360, 640, 'phone'],
      [390, 844, 'phone'],
      [844, 390, 'phone-landscape'],
      [768, 1024, 'tablet'],
      [507, 1024, 'phone'],
      [1194, 834, 'desktop'],
      [1280, 720, 'desktop'],
      [1920, 1080, 'wide'],
    ];
    for (const [w, h, expected] of cases) {
      expect(getSaleLayoutClass(w, h)).toBe(expected);
    }
  });
});

// ── getSaleLayout (spec §4.8.2) ───────────────────────────────────────────

describe('getSaleLayout', () => {
  it('gives the phone a stacked shell with no basket column', () => {
    const layout = getSaleLayout(390, 844);
    expect(layout.shell).toBe('stacked');
    expect(layout.basketWidth).toBe(0);
    expect(layout.categoryMode).toBe('strips');
  });

  it('gives phone-landscape a split shell with a compact merged category strip', () => {
    const layout = getSaleLayout(844, 390);
    expect(layout.shell).toBe('split');
    expect(layout.basketWidth).toBeGreaterThanOrEqual(280);
    expect(layout.categoryMode).toBe('merged');
    expect(layout.topBarHeight).toBe(40);
  });

  it('keeps the basket <= 50% of the window width in the split shell', () => {
    [
      [844, 390],
      [768, 1024],
      [800, 600],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
    ].forEach(([w, h]) => {
      const layout = getSaleLayout(w, h);
      expect(layout.basketWidth).toBeLessThanOrEqual(Math.round(w * 0.5));
    });
  });

  it('widens the basket on larger split classes', () => {
    expect(getSaleLayout(768, 1024).basketWidth).toBe(300);
    expect(getSaleLayout(1024, 768).basketWidth).toBe(340);
    expect(getSaleLayout(1440, 900).basketWidth).toBe(420);
  });

  it('narrows the tablet basket below 800px', () => {
    expect(getSaleLayout(768, 600).basketWidth).toBeLessThanOrEqual(300);
  });

  it('returns more columns for denser tile modes', () => {
    const layout = getSaleLayout(1280, 720);
    expect(layout.productColumns('text')).toBeGreaterThan(layout.productColumns('compact'));
    expect(layout.productColumns('compact')).toBeGreaterThan(layout.productColumns('large'));
  });
});
