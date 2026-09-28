import React, { FC, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { lightColors, spacing, typography, borderRadius, elevation, semanticColors } from '../utils/theme';
import { useResponsive } from '../hooks/useResponsive';
import { FloatingSaveBar } from '../components/FloatingSaveBar';
import { useTranslate } from '../hooks/useTranslate';
import { useAuthContext } from '../contexts/AuthProvider';
import PaymentSettingsTab from './settings/PaymentSettingsTab';
import { HardwareSettingsScreen } from './settings/HardwareSettingsScreen';
import { HardwareStatusScreen } from './HardwareStatusScreen';
import EcommerceSettingsTab from './settings/EcommerceSettingsTab';
import GenericSettingsTab from './settings/GenericSettingsTab';
import OfflineManagementTab from './settings/OfflineManagementTab';
import ReceiptSettingsTab from './settings/ReceiptSettingsTab';
import POSConfigSettingsTab from './settings/POSConfigSettingsTab';
import AuthMethodSettingsTab from './settings/AuthMethodSettingsTab';
import InstoreApiSettingsTab from './settings/InstoreApiSettingsTab';
import ThemeSettingsTab from './settings/ThemeSettingsTab';
import { composeSettingsTabs } from '../services/navigation/SettingsTabComposer';
import { getPlatformCapabilities } from '../utils/platformCapabilities';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { useTheme } from '../contexts/ThemeProvider';
import type { ECommercePlatform } from '../utils/platforms';
import type { SettingsTabKey } from '../services/navigation/SettingsTabComposer';

type SettingsTab = SettingsTabKey;
type SaveStatus = 'unsaved' | 'saving' | 'saved';

interface SettingsScreenProps {
  onGoBack?: () => void;
}

const SettingsScreen: FC<SettingsScreenProps> = ({ onGoBack }) => {
  const navigation = useNavigation();
  const { isMobile, isDesktop } = useResponsive();
  const { t } = useTranslate();
  const { user } = useAuthContext();
  const { ecommerceSettings } = useEcommerceSettings();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<SettingsTab>('generic');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Compose tabs dynamically based on selected platform capabilities
  const platform = (ecommerceSettings.platform ?? 'offline') as ECommercePlatform;
  const capabilities = useMemo(() => getPlatformCapabilities(platform), [platform]);
  const composedTabs = useMemo(
    () => composeSettingsTabs({ userRole: user?.role, platform, capabilities }),
    [user?.role, platform, capabilities]
  );

  // Filter out hidden tabs (spec requirement: settings.md §2.2.2.a, §5.12-5.14)
  const visibleTabs = useMemo(() => composedTabs.filter(tab => tab.status !== 'hidden'), [composedTabs]);

  // Settings are restricted to admin and manager roles (undefined role = cashier)
  if (!user?.role || user.role === 'cashier' || visibleTabs.length === 0) {
    return (
      <View style={[styles.accessDenied, { backgroundColor: colors.background }]}>
        <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>
          Access denied. Settings require manager or admin role.
        </Text>
      </View>
    );
  }

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const activeTabDef = visibleTabs.find(tab => tab.key === activeTab) ?? visibleTabs[0];
  const activeTabLabel = activeTabDef ? t(activeTabDef.translationKey) : '';
  const activeTabIcon = activeTabDef?.icon ?? '⚙️';

  const handleSelectTab = (tabId: SettingsTab) => {
    setActiveTab(tabId);
    setDropdownVisible(false);
  };

  const renderTabContent = () => {
    // Never render a tab the composer withheld for this role/platform
    if (!activeTabDef || activeTabDef.status !== 'enabled') return null;
    switch (activeTabDef.key) {
      case 'payment':
        return <PaymentSettingsTab />;
      case 'hardware':
        return <HardwareSettingsScreen />;
      case 'hardwareStatus':
        return (
          <HardwareStatusScreen
            onNavigateToSettings={tabKey => {
              // Map hardware status tab keys to settings tab keys
              const tabMap: Record<string, SettingsTab> = {
                printer: 'hardware',
                scanner: 'hardware',
                drawer: 'hardware',
                kds: 'hardware',
                display: 'hardware',
              };
              const targetTab = tabMap[tabKey];
              if (targetTab) {
                setActiveTab(targetTab);
              }
            }}
          />
        );
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
        return <InstoreApiSettingsTab />;
      case 'theme':
        return <ThemeSettingsTab />;
    }
  };

  // ===== DESKTOP: Side navigation =====
  if (isDesktop) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {onGoBack && (
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={[styles.backButtonText, { color: colors.primary }]}>{t('settings.backButton')}</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
        </View>

        <View style={styles.desktopLayout}>
          {/* Left nav */}
          <View style={[styles.sideNav, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
            {visibleTabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.sideNavItem,
                  activeTab === tab.key && [styles.sideNavItemActive, { backgroundColor: colors.hover, borderLeftColor: colors.primary }],
                ]}
                onPress={() => tab.status === 'enabled' && setActiveTab(tab.key)}
                disabled={tab.status === 'disabled'}
                accessibilityState={{ disabled: tab.status === 'disabled' }}
              >
                <Text style={styles.sideNavIcon}>{tab.icon}</Text>
                <View style={styles.sideNavLabelWrapper}>
                  <Text
                    style={[
                      styles.sideNavLabel,
                      { color: colors.textSecondary },
                      activeTab === tab.key && [styles.sideNavLabelActive, { color: colors.primary }],
                      tab.status === 'disabled' && styles.sideNavLabelDisabled,
                    ]}
                  >
                    {t(tab.translationKey)}
                  </Text>
                  {tab.status === 'disabled' && tab.reason ? (
                    <Text style={[styles.sideNavSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {tab.reason}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView style={[styles.desktopContent, { backgroundColor: colors.background }]}>{renderTabContent()}</ScrollView>
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {onGoBack && (
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Text style={[styles.backButtonText, { color: colors.primary }]}>{t('settings.backButton')}</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
      </View>

      {/* Mobile: Dropdown selector instead of cramped tab bar */}
      {isMobile ? (
        <View>
          <TouchableOpacity
            style={[styles.dropdown, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
            onPress={() => setDropdownVisible(true)}
          >
            <Text style={styles.dropdownIcon}>{activeTabIcon}</Text>
            <Text style={[styles.dropdownLabel, { color: colors.textPrimary }]}>{activeTabLabel}</Text>
            <Text style={[styles.dropdownArrow, { color: colors.textSecondary }]}>▾</Text>
          </TouchableOpacity>

          <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
            <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface }]}>
                {visibleTabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.dropdownItem,
                      { borderBottomColor: colors.divider },
                      activeTab === tab.key && [styles.dropdownItemActive, { backgroundColor: colors.hover }],
                    ]}
                    onPress={() => tab.status === 'enabled' && handleSelectTab(tab.key)}
                    disabled={tab.status === 'disabled'}
                  >
                    <Text style={styles.dropdownItemIcon}>{tab.icon}</Text>
                    <View style={styles.dropdownItemLabelWrapper}>
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: colors.textPrimary },
                          activeTab === tab.key && [styles.dropdownItemTextActive, { color: colors.primary }],
                        ]}
                      >
                        {t(tab.translationKey)}
                      </Text>
                      {tab.status === 'disabled' && tab.reason ? (
                        <Text style={[styles.sideNavSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {tab.reason}
                        </Text>
                      ) : null}
                    </View>
                    {activeTab === tab.key && <Text style={[styles.dropdownCheck, { color: colors.primary }]}>✓</Text>}
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
          style={[styles.tabBarScroll, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          contentContainerStyle={styles.tabBarContent}
        >
          {visibleTabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && [styles.activeTab, { borderBottomColor: colors.primary }],
                tab.status === 'disabled' && styles.tabDisabled,
              ]}
              onPress={() => tab.status === 'enabled' && setActiveTab(tab.key)}
              disabled={tab.status === 'disabled'}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  activeTab === tab.key && [styles.activeTabText, { color: colors.primary }],
                ]}
              >
                {t(tab.translationKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>{renderTabContent()}</ScrollView>

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
    borderLeftColor: lightColors.transparent,
  },
  sideNavItemActive: {
    backgroundColor: semanticColors.hover,
    borderLeftColor: lightColors.primary,
  },
  sideNavIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  sideNavLabelWrapper: {
    flex: 1,
  },
  sideNavLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  sideNavLabelActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  sideNavLabelDisabled: {
    color: lightColors.textSecondary,
    opacity: 0.5,
  },
  sideNavSubtitle: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
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
    backgroundColor: lightColors.overlay,
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
    backgroundColor: semanticColors.hover,
  },
  dropdownItemIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 24,
    textAlign: 'center',
  },
  dropdownItemLabelWrapper: {
    flex: 1,
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
    borderBottomColor: lightColors.transparent,
  },
  activeTab: {
    borderBottomColor: lightColors.primary,
  },
  tabDisabled: {
    opacity: 0.4,
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: lightColors.background,
  },
  accessDeniedText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
});

export default SettingsScreen;
