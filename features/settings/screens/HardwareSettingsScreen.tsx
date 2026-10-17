import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { ScannerSettingsTab } from './hardware/ScannerSettingsTab';
import { PrinterSettingsTab } from './hardware/PrinterSettingsTab';
import { CashDrawerSettingsTab } from './hardware/CashDrawerSettingsTab';
import { KdsSettingsTab } from './hardware/KdsSettingsTab';
import { CustomerDisplaySettingsTab } from './hardware/CustomerDisplaySettingsTab';
import { AuthHardwareSettingsTab } from './hardware/AuthHardwareSettingsTab';

type HardwareTab = 'scanner' | 'printer' | 'drawer' | 'kds' | 'display' | 'auth';

interface TabConfig {
  id: HardwareTab;
  label: string;
  icon: string;
  component: React.ComponentType;
}

const HARDWARE_TABS: TabConfig[] = [
  { id: 'scanner', label: 'Barcode Scanner', icon: '📷', component: ScannerSettingsTab },
  { id: 'printer', label: 'Receipt Printer', icon: '🖨️', component: PrinterSettingsTab },
  { id: 'drawer', label: 'Cash Drawer', icon: '💰', component: CashDrawerSettingsTab },
  { id: 'kds', label: 'Kitchen Display', icon: '🍳', component: KdsSettingsTab },
  { id: 'display', label: 'Customer Display', icon: '📺', component: CustomerDisplaySettingsTab },
  { id: 'auth', label: 'Auth Hardware', icon: '🔐', component: AuthHardwareSettingsTab },
];

/**
 * Centralized hardware settings screen with tabbed interface
 * for all hardware integrations (Scanner, Printer, Drawer, KDS, Display, Auth)
 */
export function HardwareSettingsScreen() {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<HardwareTab>('scanner');

  const ActiveComponent = HARDWARE_TABS.find(t => t.id === activeTab)?.component ?? ScannerSettingsTab;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Hardware Settings</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Configure barcode scanners, printers, and other peripherals
        </Text>
      </View>

      {/* Tab Navigation */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabBarContent}
      >
        {HARDWARE_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { ...styles.tabActive, borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.primary : colors.textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Active Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <ActiveComponent />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabBar: {
    borderBottomWidth: 1,
    maxHeight: 60,
  },
  tabBarContent: {
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
});
