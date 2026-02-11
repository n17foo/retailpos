import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../utils/theme';

export interface BreadcrumbItem {
  id: string;
  label: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (id: string | null) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => onNavigate(null)} style={styles.item}>
        <Text style={[styles.text, styles.link]}>All</Text>
      </TouchableOpacity>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={item.id} style={styles.segment}>
            <Text style={styles.separator}>/</Text>
            {isLast ? (
              <Text style={[styles.text, styles.current]}>{item.label}</Text>
            ) : (
              <TouchableOpacity onPress={() => onNavigate(item.id)} style={styles.item}>
                <Text style={[styles.text, styles.link]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexWrap: 'wrap',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    paddingVertical: 2,
  },
  separator: {
    marginHorizontal: spacing.xs,
    color: lightColors.textHint,
    fontSize: typography.fontSize.sm,
  },
  text: {
    fontSize: typography.fontSize.sm,
  },
  link: {
    color: lightColors.primary,
    fontWeight: '500',
  },
  current: {
    color: lightColors.textPrimary,
    fontWeight: '600',
  },
});

export default Breadcrumb;
