import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../shared/contexts/ThemeProvider';
import { Card } from '../../../../shared/components/Card';

/**
 * Printer settings tab - delegates to existing PrinterScreen
 */
export function PrinterSettingsTab() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Card style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Receipt Printer</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Printer configuration is available in the dedicated Printer screen. Navigate to Settings → Printer to configure receipt printers.
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
