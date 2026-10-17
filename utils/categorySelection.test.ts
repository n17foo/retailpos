import type { UnifiedCategory } from '../services/category/types';
import { ECommercePlatform } from './platforms';
import { EMPTY_SELECTION, effectiveCategoryId, getSubRow, goUp, selectRoot, selectSub } from './categorySelection';

const cat = (id: string, parentId?: string): UnifiedCategory => ({
  id,
  name: id,
  platformId: id,
  parentId,
  position: 0,
  productCount: 0,
  status: 'active',
  isFeatured: false,
  level: parentId ? 1 : 0,
  path: [],
  syncedAt: new Date(0),
  platform: ECommercePlatform.OFFLINE,
});

// Tree: Drinks → Hot → {Espresso, Filter}; Drinks → Cold; Food (leaf); Retail (leaf)
const categories: UnifiedCategory[] = [
  cat('Drinks'),
  cat('Hot', 'Drinks'),
  cat('Cold', 'Drinks'),
  cat('Espresso', 'Hot'),
  cat('Filter', 'Hot'),
  cat('Food'),
  cat('Retail'),
];

describe('category selection state machine', () => {
  it('starts on All Products (D2)', () => {
    expect(effectiveCategoryId(EMPTY_SELECTION)).toBeNull();
    expect(getSubRow(EMPTY_SELECTION, categories).items).toHaveLength(0);
  });

  it('selecting a root filters the whole subtree and shows its children', () => {
    const s = selectRoot(EMPTY_SELECTION, 'Drinks');
    expect(effectiveCategoryId(s)).toBe('Drinks');
    const row = getSubRow(s, categories);
    expect(row.items.map(c => c.id)).toEqual(['Hot', 'Cold']);
    expect(row.drilled).toBe(false);
  });

  it('selecting a leaf sub narrows the filter', () => {
    let s = selectRoot(EMPTY_SELECTION, 'Drinks');
    s = selectSub(s, 'Cold', categories);
    expect(effectiveCategoryId(s)).toBe('Cold');
    expect(s.drillParentId).toBe('Drinks');
  });

  it('re-tapping the active leaf returns to the parent All', () => {
    let s = selectRoot(EMPTY_SELECTION, 'Drinks');
    s = selectSub(s, 'Cold', categories);
    s = selectSub(s, 'Cold', categories);
    expect(effectiveCategoryId(s)).toBe('Drinks');
    expect(s.subId).toBeNull();
  });

  it('selecting a sub-category with children drills row 2', () => {
    let s = selectRoot(EMPTY_SELECTION, 'Drinks');
    s = selectSub(s, 'Hot', categories);
    expect(effectiveCategoryId(s)).toBe('Hot');
    const row = getSubRow(s, categories);
    expect(row.drilled).toBe(true);
    expect(row.parentName).toBe('Hot');
    expect(row.items.map(c => c.id)).toEqual(['Espresso', 'Filter']);
  });

  it('the leading chip goes back up one drill level', () => {
    let s = selectRoot(EMPTY_SELECTION, 'Drinks');
    s = selectSub(s, 'Hot', categories);
    s = selectSub(s, 'Espresso', categories);
    s = goUp(s, categories);
    expect(effectiveCategoryId(s)).toBe('Hot');
    const row = getSubRow(s, categories);
    expect(row.drilled).toBe(true);
    expect(row.items.map(c => c.id)).toEqual(['Espresso', 'Filter']);
  });

  it('going up from the first sub level returns to the root children', () => {
    let s = selectRoot(EMPTY_SELECTION, 'Drinks');
    s = selectSub(s, 'Hot', categories);
    s = goUp(s, categories);
    expect(effectiveCategoryId(s)).toBe('Drinks');
    const row = getSubRow(s, categories);
    expect(row.drilled).toBe(false);
    expect(row.items.map(c => c.id)).toEqual(['Hot', 'Cold']);
  });

  it('re-tapping the active root returns to All Products', () => {
    let s = selectRoot(EMPTY_SELECTION, 'Drinks');
    s = selectRoot(s, 'Drinks');
    expect(s).toEqual(EMPTY_SELECTION);
  });

  it('a root without children hides row 2', () => {
    const s = selectRoot(EMPTY_SELECTION, 'Food');
    const row = getSubRow(s, categories);
    expect(row.parentId).toBeNull();
    expect(row.items).toHaveLength(0);
  });
});
