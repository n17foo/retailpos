import React, { FC, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { useResponsive } from '../hooks/useResponsive';
import { FloatingSaveBar } from '../components/FloatingSaveBar';
import { useTranslate } from '../hooks/useTranslate';
import PaymentSettingsTab from './settings/PaymentSettingsTab';
import PrinterSettingsTab from './settings/PrinterSettingsTab';
import ScannerSettingsTab from './settings/ScannerSettingsTab';
import EcommerceSettingsTab from './settings/EcommerceSettingsTab';
import GenericSettingsTab from './settings/GenericSettingsTab';
import OfflineManagementTab from './settings/OfflineManagementTab';
import ReceiptSettingsTab from './settings/ReceiptSettingsTab';
import POSConfigSettingsTab from './settings/POSConfigSettingsTab';
import AuthMethodSettingsTab from './settings/AuthMethodSettingsTab';
import LocalApiSettingsTab from './settings/LocalApiSettingsTab';

type SettingsTab = 'generic' | 'pos' | 'auth' | 'payment' | 'printer' | 'scanner' | 'ecommerce' | 'offline' | 'receipt' | 'multiregister';
type SaveStatus = 'unsaved' | 'saving' | 'saved';

const TAB_ICONS: Record<SettingsTab, string> = {
  generic: '⚙️',
  pos: '🏪',
  auth: '🔐',
  payment: '💳',
  printer: '🖨',
  scanner: '📷',
  ecommerce: '🛒',
  offline: '📴',
  receipt: '🧾',
  multiregister: '🔗',
};

const TAB_TRANSLATION_KEYS: Record<SettingsTab, string> = {
  generic: 'settings.tabs.general',
  pos: 'settings.tabs.posConfig',
  auth: 'settings.tabs.authentication',
  payment: 'settings.tabs.payment',
  printer: 'settings.tabs.printer',
  scanner: 'settings.tabs.scanner',
  ecommerce: 'settings.tabs.ecommerce',
  offline: 'settings.tabs.offline',
  receipt: 'settings.tabs.receipt',
  multiregister: 'settings.tabs.multiRegister',
};

const TAB_ORDER: SettingsTab[] = [
  'generic',
  'pos',
  'auth',
  'payment',
  'printer',
  'scanner',
  'ecommerce',
  'offline',
  'receipt',
  'multiregister',
];

interface SettingsScreenProps {
  onGoBack?: () => void;
}

const SettingsScreen: FC<SettingsScreenProps> = ({ onGoBack }) => {
  const navigation = useNavigation();
  const { isMobile, isDesktop } = useResponsive();
  const { t } = useTranslate();

  const [activeTab, setActiveTab] = useState<SettingsTab>('generic');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const activeTabLabel = t(TAB_TRANSLATION_KEYS[activeTab]);
  const activeTabIcon = TAB_ICONS[activeTab];

  const handleSelectTab = (tabId: SettingsTab) => {
    setActiveTab(tabId);
    setDropdownVisible(false);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'payment':
        return <PaymentSettingsTab />;
      case 'printer':
        return <PrinterSettingsTab />;
      case 'scanner':
        return <ScannerSettingsTab />;
      case 'ecommerce':
        return <EcommerceSettingsTab />;
      case 'generic':
        return <GenericSettingsTab />;
      case 'pos':
        return <POSConfigSettingsTab />;
      case 'auth':
        return <AuthMethodSettingsTab />;
      case 'offline':
        return <OfflineManagementTab />;
      case 'receipt':
        return <ReceiptSettingsTab />;
      case 'multiregister':
        return <LocalApiSettingsTab />;
    }
  };

  // ===== DESKTOP: Side navigation =====
  if (isDesktop) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
        <View style={styles.header}>
          {onGoBack && (
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>{t('settings.backButton')}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        </View>

        <View style={styles.desktopLayout}>
          {/* Left nav */}
          <View style={styles.sideNav}>
            {TAB_ORDER.map(tabId => (
              <TouchableOpacity
                key={tabId}
                style={[styles.sideNavItem, activeTab === tabId && styles.sideNavItemActive]}
                onPress={() => setActiveTab(tabId)}
              >
                <Text style={styles.sideNavIcon}>{TAB_ICONS[tabId]}</Text>
                <Text style={[styles.sideNavLabel, activeTab === tabId && styles.sideNavLabelActive]}>
                  {t(TAB_TRANSLATION_KEYS[tabId])}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView style={styles.desktopContent}>{renderTabContent()}</ScrollView>
        </View>

        <FloatingSaveBar
          visible={saveStatus === 'unsaved'}
          onSave={() => setSaveStatus('saved')}
          onDiscard={() => setSaveStatus('saved')}
          saving={saveStatus === 'saving'}
        />
      </KeyboardAvoidingView>
    );
  }

  // ===== MOBILE / TABLET =====
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={100}>
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Text style={styles.backButtonText}>{t('settings.backButton')}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      {/* Mobile: Dropdown selector instead of cramped tab bar */}
      {isMobile ? (
        <View>
          <TouchableOpacity style={styles.dropdown} onPress={() => setDropdownVisible(true)}>
            <Text style={styles.dropdownIcon}>{activeTabIcon}</Text>
            <Text style={styles.dropdownLabel}>{activeTabLabel}</Text>
            <Text style={styles.dropdownArrow}>▾</Text>
          </TouchableOpacity>

          <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
            <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
              <View style={styles.dropdownMenu}>
                {TAB_ORDER.map(tabId => (
                  <TouchableOpacity
                    key={tabId}
                    style={[styles.dropdownItem, activeTab === tabId && styles.dropdownItemActive]}
                    onPress={() => handleSelectTab(tabId)}
                  >
                    <Text style={styles.dropdownItemIcon}>{TAB_ICONS[tabId]}</Text>
                    <Text style={[styles.dropdownItemText, activeTab === tabId && styles.dropdownItemTextActive]}>
                      {t(TAB_TRANSLATION_KEYS[tabId])}
                    </Text>
                    {activeTab === tabId && <Text style={styles.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      ) : (
        // Tablet: Scrollable tab bar (fits better than mobile)
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBarContent}
        >
          {TAB_ORDER.map(tabId => (
            <TouchableOpacity key={tabId} style={[styles.tab, activeTab === tabId && styles.activeTab]} onPress={() => setActiveTab(tabId)}>
              <Text style={[styles.tabText, activeTab === tabId && styles.activeTabText]}>{t(TAB_TRANSLATION_KEYS[tabId])}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.content}>{renderTabContent()}</ScrollView>

      <FloatingSaveBar
        visible={saveStatus === 'unsaved'}
        onSave={() => setSaveStatus('saved')}
        onDiscard={() => setSaveStatus('saved')}
        saving={saveStatus === 'saving'}
      />
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
  // ===== Desktop side nav =====
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sideNav: {
    width: 220,
    backgroundColor: lightColors.surface,
    borderRightWidth: 1,
    borderRightColor: lightColors.border,
    paddingTop: spacing.sm,
  },
  sideNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  sideNavItemActive: {
    backgroundColor: '#E3F2FD',
    borderLeftColor: lightColors.primary,
  },
  sideNavIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  sideNavLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  sideNavLabelActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  desktopContent: {
    flex: 1,
    padding: spacing.lg,
  },
  // ===== Mobile dropdown =====
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  dropdownIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  dropdownArrow: {
    fontSize: 16,
    color: lightColors.textSecondary,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    paddingTop: 120,
  },
  dropdownMenu: {
    marginHorizontal: spacing.md,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    ...elevation.high,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
  },
  dropdownItemActive: {
    backgroundColor: '#E3F2FD',
  },
  dropdownItemIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  dropdownItemTextActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  dropdownCheck: {
    color: lightColors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  // ===== Tablet tab bar =====
  tabBarScroll: {
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
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
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
});

export default SettingsScreen;
