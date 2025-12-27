import React, { FC, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import PaymentSettingsTab from './settings/PaymentSettingsTab';
import PrinterSettingsTab from './settings/PrinterSettingsTab';
import ScannerSettingsTab from './settings/ScannerSettingsTab';
import EcommerceSettingsTab from './settings/EcommerceSettingsTab';
import GenericSettingsTab from './settings/GenericSettingsTab';

type SettingsTab = 'generic' | 'payment' | 'printer' | 'scanner' | 'ecommerce';
type SaveStatus = 'unsaved' | 'saving' | 'saved';

interface SettingsScreenProps {
  onGoBack?: () => void;
}

const SettingsScreen: FC<SettingsScreenProps> = ({ onGoBack }) => {
  const navigation = useNavigation();

  // Local state for tab and save status management
  const [activeTab, setActiveTab] = useState<SettingsTab>('generic');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'generic' && styles.activeTab]} onPress={() => setActiveTab('generic')}>
          <Text style={[styles.tabText, activeTab === 'generic' && styles.activeTabText]}>General</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'payment' && styles.activeTab]} onPress={() => setActiveTab('payment')}>
          <Text style={[styles.tabText, activeTab === 'payment' && styles.activeTabText]}>Payment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'printer' && styles.activeTab]} onPress={() => setActiveTab('printer')}>
          <Text style={[styles.tabText, activeTab === 'printer' && styles.activeTabText]}>Printer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'scanner' && styles.activeTab]} onPress={() => setActiveTab('scanner')}>
          <Text style={[styles.tabText, activeTab === 'scanner' && styles.activeTabText]}>Scanner</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'ecommerce' && styles.activeTab]} onPress={() => setActiveTab('ecommerce')}>
          <Text style={[styles.tabText, activeTab === 'ecommerce' && styles.activeTabText]}>E-Comm</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'payment' && <PaymentSettingsTab />}
        {activeTab === 'printer' && <PrinterSettingsTab />}
        {activeTab === 'scanner' && <ScannerSettingsTab />}
        {activeTab === 'ecommerce' && <EcommerceSettingsTab />}
        {activeTab === 'generic' && <GenericSettingsTab />}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.saveStatusContainer}>
          <Text style={[styles.saveStatus, saveStatus === 'saved' && styles.savedText]}>
            {saveStatus === 'unsaved' && 'You have unsaved changes'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'All changes saved'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saveStatus !== 'unsaved' && styles.saveButtonDisabled]}
          onPress={() => setSaveStatus('saved')}
          disabled={saveStatus !== 'unsaved'}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    color: lightColors.primary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: lightColors.primary,
  },
  tabText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  activeTabText: {
    color: lightColors.primary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
  },
  saveStatusContainer: {
    flex: 1,
  },
  saveStatus: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  savedText: {
    color: lightColors.success,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: lightColors.textDisabled,
  },
  saveButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '700', // Using literal value as React Native expects specific string literals
  },
});

export default SettingsScreen;
