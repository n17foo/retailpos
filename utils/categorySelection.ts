import type { UnifiedCategory } from '../services/category/types';

/**
 * Pure category-selection state machine for the sale screen category buttons
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.3).
 *
 * No React — unit testable in node.
 *
 * Model:
 *  - `rootId`        — the selected root category (null = "All Products", the default per D2)
 *  - `subId`         — the deepest selected category (null = "All {root}")
 *  - `drillParentId` — the category whose children row 2 currently shows. Equals `rootId`
 *                      at the first sub level; tapping a sub-category that has children
 *                      drills into it, turning row 2 into "‹ {parent}" + its children.
 */
export interface CategorySelectionState {
  rootId: string | null;
  subId: string | null;
  drillParentId: string | null;
}

export const EMPTY_SELECTION: CategorySelectionState = {
  rootId: null,
  subId: null,
  drillParentId: null,
};

/** The category the product grid should filter by (null = all products) */
export function effectiveCategoryId(state: CategorySelectionState): string | null {
  return state.subId ?? state.rootId;
}

/**
 * Tap a root button.
 *  - `null` (the "All" button) resets the whole selection.
 *  - Re-tapping the already selected root returns to the global "All" when no
 *    sub is selected, otherwise it returns to "All {root}".
 */
export function selectRoot(state: CategorySelectionState, rootId: string | null): CategorySelectionState {
  if (rootId === null) {
    return EMPTY_SELECTION;
  }
  if (rootId === state.rootId) {
    if (state.subId === null) {
      return EMPTY_SELECTION;
    }
    return { rootId, subId: null, drillParentId: rootId };
  }
  return { rootId, subId: null, drillParentId: rootId };
}

/**
 * Tap a button in the sub-category row.
 *  - A leaf narrows the filter to it; re-tapping it returns to the parent's "All".
 *  - A category with children selects it AND drills row 2 into its children.
 */
export function selectSub(state: CategorySelectionState, id: string, categories: UnifiedCategory[]): CategorySelectionState {
  const parentOf = (c: UnifiedCategory): string | null => c.parentId ?? null;
  const target = categories.find(c => c.id === id);
  if (!target) return state;

  // Re-tap of the selected leaf → return to the parent's "All"
  if (id === state.subId) {
    return { ...state, subId: state.drillParentId !== state.rootId ? state.drillParentId : null };
  }

  const hasChildren = categories.some(c => c.parentId === id);
  return {
    rootId: state.rootId,
    subId: id,
    drillParentId: hasChildren ? id : (parentOf(target) ?? state.drillParentId),
  };
}

/**
 * Tap the leading "‹ {parent}" chip in a drilled row 2 — step back one level.
 *  - A leaf inside the drilled row is selected → the selection steps back to the
 *    drilled parent itself (row 2 keeps showing the parent's children).
 *  - The drilled parent itself is selected → row 2 un-drills one level.
 */
export function goUp(state: CategorySelectionState, categories: UnifiedCategory[]): CategorySelectionState {
  const drill = state.drillParentId;
  if (!drill) return state;
  if (state.subId && state.subId !== drill) {
    return { ...state, subId: drill };
  }
  if (drill === state.rootId) return state;
  const parent = categories.find(c => c.id === drill)?.parentId ?? state.rootId;
  const newDrill = parent ?? state.rootId;
  return {
    rootId: state.rootId,
    drillParentId: newDrill,
    subId: newDrill === state.rootId ? null : newDrill,
  };
}

export interface SubRowModel {
  /** The parent whose children appear in row 2 (null → row 2 hidden) */
  parentId: string | null;
  /** Row-2 is drilled into level ≥ 3 — render "‹ {parentName}" instead of "All {parent}" */
  drilled: boolean;
  /** Children to render as buttons */
  items: UnifiedCategory[];
  /** Parent name for the "All {name}" / "‹ {name}" label */
  parentName: string | undefined;
}

/** Derives what row 2 displays for the current selection */
export function getSubRow(state: CategorySelectionState, categories: UnifiedCategory[]): SubRowModel {
  const parentId = state.drillParentId ?? state.rootId;
  if (!parentId) {
    return { parentId: null, drilled: false, items: [], parentName: undefined };
  }
  const items = categories.filter(c => c.parentId === parentId);
  return {
    parentId: items.length > 0 ? parentId : null,
    drilled: parentId !== state.rootId,
    items,
    parentName: categories.find(c => c.id === parentId)?.name,
  };
}
