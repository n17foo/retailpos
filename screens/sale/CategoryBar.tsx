import React, { memo, useMemo } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { lightColors, spacing } from '../../utils/theme';
import { useCategoryContext } from '../../contexts/CategoryProvider';
import { CategoryButton } from './CategoryButton';
import type { CategoryMode } from '../../utils/responsive.utils';
import type { UnifiedCategory } from '../../services/category/types';

interface CategoryBarProps {
  mode: CategoryMode;
  /** Touch targets get 56px, pointer gets 44px */
  targetSize?: number;
}

/**
 * Persistent category buttons below the top bar
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.3).
 *
 *  - Row 1: [All] + every root category — always visible, never replaced.
 *  - Row 2: [All {root}] or [‹ {parent}] + the parent's children.
 *  - 'merged' mode (short landscape screens): one strip — roots, with the
 *    selected root's children appended after it.
 *  - 'wrapped' mode: roots wrap onto up to two lines; children scroll below.
 *  - 'strips' mode: two horizontally scrolling strips.
 */
const CategoryBarInner: React.FC<CategoryBarProps> = ({ mode, targetSize = 48 }) => {
  const { categories, isLoading, rootCategories, subRow, selectedRootId, selectedSubId, select, goUp } = useCategoryContext();

  const childIds = useMemo(() => new Set(categories.filter(c => c.parentId).map(c => c.parentId as string)), [categories]);
  const hasChildren = useMemo(() => (c: UnifiedCategory) => childIds.has(c.id), [childIds]);

  /** Row-2 contents: leading "All {root}" / "‹ {parent}" + children */
  const subButtons = useMemo(() => {
    if (!subRow.parentId) return null;
    return (
      <>
        {subRow.drilled ? (
          <CategoryButton key="__back__" label={subRow.parentName ?? 'Back'} isBackChip onPress={goUp} targetSize={targetSize} />
        ) : (
          <CategoryButton
            key="__all__"
            label={`All ${subRow.parentName ?? ''}`}
            selected={selectedSubId === null}
            onPress={() => subRow.parentId && select(subRow.parentId)}
            targetSize={targetSize}
          />
        )}
        {subRow.items.map(c => (
          <CategoryButton
            key={c.id}
            label={c.name}
            selected={selectedSubId === c.id}
            hasChildren={hasChildren(c)}
            onPress={() => select(c.id)}
            targetSize={targetSize}
          />
        ))}
      </>
    );
  }, [subRow, selectedSubId, select, goUp, targetSize, hasChildren]);

  if (isLoading && categories.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={lightColors.primary} />
      </View>
    );
  }
  if (rootCategories.length === 0) return null;

  const rootButton = (c: UnifiedCategory) => (
    <CategoryButton
      key={c.id}
      label={c.name}
      selected={selectedRootId === c.id}
      hasChildren={hasChildren(c)}
      onPress={() => select(c.id)}
      targetSize={targetSize}
    />
  );

  const allButton = (
    <CategoryButton
      key="__root_all__"
      label="All"
      selected={selectedRootId === null}
      onPress={() => select(null)}
      targetSize={targetSize}
    />
  );

  if (mode === 'merged') {
    // One strip: All + roots, with the selected root's children appended after it
    const merged: React.ReactNode[] = [allButton];
    rootCategories.forEach(c => {
      merged.push(rootButton(c));
      if (c.id === selectedRootId && subButtons) merged.push(subButtons);
    });
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
        {merged}
      </ScrollView>
    );
  }

  if (mode === 'wrapped') {
    return (
      <View style={styles.container}>
        <View style={styles.wrapped}>
          {allButton}
          {rootCategories.map(rootButton)}
        </View>
        {subButtons && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
            {subButtons}
          </ScrollView>
        )}
      </View>
    );
  }

  // 'strips': two horizontally scrolling strips
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
        {allButton}
        {rootCategories.map(rootButton)}
      </ScrollView>
      {subButtons && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
          {subButtons}
        </ScrollView>
      )}
    </View>
  );
};

export const CategoryBar = memo(CategoryBarInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    paddingTop: spacing.xs,
  },
  loading: { paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: lightColors.surface },
  strip: { flexGrow: 0 },
  stripContent: { paddingHorizontal: spacing.sm, alignItems: 'center' },
  wrapped: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
    maxHeight: 108, // two button rows
    overflow: 'hidden',
  },
});
