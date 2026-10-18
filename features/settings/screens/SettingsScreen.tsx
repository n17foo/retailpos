import React, { FC, useState, useMemo } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useResponsive } from '../../../shared/hooks/useResponsive';
import { FloatingSaveBar } from '../components/FloatingSaveBar';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import PaymentSettingsTab from './PaymentSettingsTab';
import { HardwareSettingsScreen } from './HardwareSettingsScreen';
import { HardwareStatusScreen } from '../../hardware/screens/HardwareStatusScreen';
import EcommerceSettingsTab from './EcommerceSettingsTab';
import GenericSettingsTab from './GenericSettingsTab';
import OfflineManagementTab from './OfflineManagementTab';
import ReceiptSettingsTab from './ReceiptSettingsTab';
import POSConfigSettingsTab from './POSConfigSettingsTab';
import AuthMethodSettingsTab from './AuthMethodSettingsTab';
import InstoreApiSettingsTab from './InstoreApiSettingsTab';
import ThemeSettingsTab from './ThemeSettingsTab';
import { composeSettingsTabs } from '../services/SettingsTabComposer';
import { getPlatformCapabilities } from '../../../shared/utils/platformCapabilities';
import { useEcommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import type { ECommercePlatform } from '../../../shared/utils/platforms';
import type { SettingsTabKey } from '../services/SettingsTabComposer';
import { settingsScreenStyles as styles } from '../components/settingsScreenStyles';
import { SettingsHeader } from '../components/SettingsHeader';
import { SettingsSideNav } from '../components/SettingsSideNav';
import { SettingsTabDropdown } from '../components/SettingsTabDropdown';
import { SettingsTabBar } from '../components/SettingsTabBar';

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

  const floatingSaveBar = (
    <FloatingSaveBar
      visible={saveStatus === 'unsaved'}
      onSave={() => setSaveStatus('saved')}
      onDiscard={() => setSaveStatus('saved')}
      saving={saveStatus === 'saving'}
    />
  );

  // ===== DESKTOP: Side navigation =====
  if (isDesktop) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <SettingsHeader showBackButton={!!onGoBack} onGoBack={handleGoBack} />

        <View style={styles.desktopLayout}>
          <SettingsSideNav tabs={visibleTabs} activeTab={activeTab} onSelectTab={setActiveTab} />
          <ScrollView style={[styles.desktopContent, { backgroundColor: colors.background }]}>{renderTabContent()}</ScrollView>
        </View>

        {floatingSaveBar}
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
      <SettingsHeader showBackButton={!!onGoBack} onGoBack={handleGoBack} />

      {/* Mobile: Dropdown selector instead of cramped tab bar */}
      {isMobile ? (
        <SettingsTabDropdown
          tabs={visibleTabs}
          activeTab={activeTab}
          activeTabIcon={activeTabIcon}
          activeTabLabel={activeTabLabel}
          onSelectTab={setActiveTab}
        />
      ) : (
        // Tablet: Scrollable tab bar (fits better than mobile)
        <SettingsTabBar tabs={visibleTabs} activeTab={activeTab} onSelectTab={setActiveTab} />
      )}

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>{renderTabContent()}</ScrollView>

      {floatingSaveBar}
    </KeyboardAvoidingView>
  );
};

export default SettingsScreen;
