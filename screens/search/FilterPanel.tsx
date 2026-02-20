import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SearchOptions } from '../../services/search/SearchServiceInterface';
import { Button } from '../../components/Button';
import { lightColors, spacing, typography } from '../../utils/theme';

interface FilterPanelProps {
  filterOptions: SearchOptions;
  onFilterChange: (key: keyof SearchOptions, value: SearchOptions[keyof SearchOptions]) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filterOptions, onFilterChange }) => {
  return (
    <View style={styles.filtersContainer}>
      <Text style={styles.filterTitle}>Filter Results</Text>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Include Local Products:</Text>
        <Button
          title={filterOptions.includeLocal ? 'On' : 'Off'}
          variant={filterOptions.includeLocal ? 'success' : 'outline'}
          size="sm"
          onPress={() => onFilterChange('includeLocal', !filterOptions.includeLocal)}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Include Online Products:</Text>
        <Button
          title={filterOptions.includeEcommerce ? 'On' : 'Off'}
          variant={filterOptions.includeEcommerce ? 'success' : 'outline'}
          size="sm"
          onPress={() => onFilterChange('includeEcommerce', !filterOptions.includeEcommerce)}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>In Stock Only:</Text>
        <Button
          title={filterOptions.inStock ? 'On' : 'Off'}
          variant={filterOptions.inStock ? 'success' : 'outline'}
          size="sm"
          onPress={() => onFilterChange('inStock', !filterOptions.inStock)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  filtersContainer: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  filterTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as '600',
    marginBottom: spacing.sm,
    color: lightColors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row' as 'row',
    justifyContent: 'space-between' as 'space-between',
    alignItems: 'center' as 'center',
    marginBottom: spacing.xs,
  },
  filterLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
});

export default FilterPanel;
