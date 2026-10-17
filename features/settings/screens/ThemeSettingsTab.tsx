/**
 * ThemeSettingsTab
 *
 * Lets the user pick a color theme for the POS.
 * The selected theme is applied immediately and persisted across restarts.
 *
 * Satisfies: docs/specs/settings/settings-tabs.md — Theme tab
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { THEME_ORDER, THEME_PRESETS, ThemeId } from '../../../shared/utils/themes';
import { spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';

const ThemeSettingsTab: React.FC = () => {
  const { colors, themeId, setTheme } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose a theme</Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        Align the POS colors with your brand. Changes apply immediately.
      </Text>

      {THEME_ORDER.map(id => {
        const preset = THEME_PRESETS[id];
        const isActive = themeId === id;
        const [swatchA, swatchB, swatchBg] = preset.swatch;

        return (
          <TouchableOpacity
            key={id}
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: isActive ? colors.primary : colors.border },
              isActive && styles.cardActive,
            ]}
            onPress={() => setTheme(id as ThemeId)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel={`${preset.name} theme — ${preset.description}`}
          >
            {/* Color swatches */}
            <View style={[styles.swatchRow, { backgroundColor: swatchBg, borderColor: colors.border }]}>
              <View style={[styles.swatch, { backgroundColor: swatchA }]} />
              <View style={[styles.swatch, { backgroundColor: swatchB }]} />
              <View style={[styles.swatchBg, { backgroundColor: swatchBg, borderColor: colors.border }]} />
            </View>

            {/* Label */}
            <View style={styles.labelBlock}>
              <Text style={[styles.themeName, { color: colors.textPrimary }]}>
                {preset.name}
                {preset.isDark && <Text style={[styles.darkBadge, { color: colors.textSecondary }]}> · Dark</Text>}
              </Text>
              <Text style={[styles.themeDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {preset.description}
              </Text>
            </View>

            {/* Active checkmark */}
            {isActive && <MaterialIcons name="check-circle" size={22} color={colors.primary} style={styles.checkIcon} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as '700',
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    marginBottom: spacing.sm,
    padding: spacing.md,
    ...elevation.low,
  },
  cardActive: {
    ...elevation.medium,
  },
  swatchRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: spacing.md,
    width: 64,
    height: 44,
  },
  swatch: {
    flex: 1,
  },
  swatchBg: {
    flex: 1,
    borderLeftWidth: 1,
  },
  labelBlock: {
    flex: 1,
  },
  themeName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold as '600',
    marginBottom: 2,
  },
  darkBadge: {
    fontWeight: typography.fontWeight.regular as '400',
    fontSize: typography.fontSize.sm,
  },
  themeDescription: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
  checkIcon: {
    marginLeft: spacing.sm,
  },
});

export default ThemeSettingsTab;
