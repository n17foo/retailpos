import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../shared/contexts/ThemeProvider';
import { Card } from '../../../../shared/components/Card';

/**
 * Customer display settings tab - placeholder for future implementation
 */
export function CustomerDisplaySettingsTab() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Customer-Facing Display</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Customer display configuration will be available in a future update. This feature allows you to show basket contents on a second
          screen for customers.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  section: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionDescription: {
    fontSize: 14,
  },
});
