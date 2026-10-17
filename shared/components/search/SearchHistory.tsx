import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography } from '../../utils/theme';

interface SearchHistoryProps {
  history: string[];
  onHistoryItemPress: (item: string) => void;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onHistoryItemPress }) => {
  if (!history.length) {
    return null;
  }

  return (
    <View style={styles.historyContainer}>
      <Text style={styles.sectionTitle}>Recent Searches</Text>
      {history.map((item, index) => (
        <TouchableOpacity key={index} style={styles.historyItem} onPress={() => onHistoryItemPress(item)}>
          <MaterialIcons name="history" size={16} color={lightColors.textSecondary} />
          <Text style={styles.historyText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  historyContainer: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as '600',
    marginBottom: spacing.sm,
    color: lightColors.textPrimary,
  },
  historyItem: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  historyText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginLeft: spacing.sm,
  },
});

export default SearchHistory;
