import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../utils/theme';

interface SearchHeaderProps {
  query: string;
  searchField: 'name' | 'sku' | 'barcode' | 'all';
  showFilters: boolean;
  onQueryChange: (text: string) => void;
  onSearchFieldChange: (field: 'name' | 'sku' | 'barcode' | 'all') => void;
  onToggleFilters: () => void;
}

const SearchHeader: React.FC<SearchHeaderProps> = ({
  query,
  searchField,
  showFilters,
  onQueryChange,
  onSearchFieldChange,
  onToggleFilters,
}) => {
  return (
    <View style={styles.searchSection}>
      <Text style={styles.searchTitle}>Find Products</Text>

      {/* Search input with icon inside */}
      <View style={styles.searchInputContainer}>
        <MaterialIcons name="search" size={24} color={lightColors.textHint} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for products..."
          placeholderTextColor={lightColors.textHint}
          value={query}
          onChangeText={onQueryChange}
          autoFocus={true}
        />
        {query.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => onQueryChange('')}>
            <Ionicons name="close-circle" size={20} color={lightColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search field selection tabs */}
      <View style={styles.searchFieldTabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.searchFieldTab, searchField === 'all' && styles.activeSearchFieldTab]}
            onPress={() => onSearchFieldChange('all')}
          >
            <Text style={[styles.searchFieldTabText, searchField === 'all' && styles.activeSearchFieldTabText]}>All Fields</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchFieldTab, searchField === 'name' && styles.activeSearchFieldTab]}
            onPress={() => onSearchFieldChange('name')}
          >
            <Text style={[styles.searchFieldTabText, searchField === 'name' && styles.activeSearchFieldTabText]}>Name</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchFieldTab, searchField === 'sku' && styles.activeSearchFieldTab]}
            onPress={() => onSearchFieldChange('sku')}
          >
            <Text style={[styles.searchFieldTabText, searchField === 'sku' && styles.activeSearchFieldTabText]}>SKU</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchFieldTab, searchField === 'barcode' && styles.activeSearchFieldTab]}
            onPress={() => onSearchFieldChange('barcode')}
          >
            <Text style={[styles.searchFieldTabText, searchField === 'barcode' && styles.activeSearchFieldTabText]}>Barcode</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Filter toggle */}
      <TouchableOpacity style={styles.filterToggleButton} onPress={onToggleFilters}>
        <MaterialIcons name={showFilters ? 'filter-list-off' : 'filter-list'} size={20} color={lightColors.primary} />
        <Text style={styles.filterToggleText}>{showFilters ? 'Hide Filters' : 'Filters'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  searchSection: {
    backgroundColor: lightColors.primary,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    ...elevation.medium,
    marginBottom: spacing.md,
  },
  searchTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700' as '700',
    color: lightColors.textOnPrimary,
    marginBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...elevation.low,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: lightColors.textPrimary,
    fontSize: typography.fontSize.md,
  },
  searchFieldTabContainer: {
    marginBottom: spacing.md,
  },
  searchFieldTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.whiteOverlayLight,
    borderWidth: 1,
    borderColor: lightColors.whiteOverlayMedium,
  },
  activeSearchFieldTab: {
    backgroundColor: lightColors.surface,
    borderColor: lightColors.surface,
    ...elevation.low,
  },
  searchFieldTabText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '500' as '500',
  },
  activeSearchFieldTabText: {
    color: lightColors.primary,
    fontWeight: '700' as '700',
  },
  filterToggleButton: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: lightColors.whiteOverlayLight,
    borderRadius: borderRadius.round,
    alignSelf: 'center' as 'center',
  },
  filterToggleText: {
    color: lightColors.textOnPrimary,
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '500' as '500',
  },
});

export default SearchHeader;
