import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboardingContext } from '../contexts/OnboardingProvider';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { spacing } from '../utils/theme';

import WelcomeStep from './onboarding/WelcomeStep';
import PlatformSelectionStep from './onboarding/PlatformSelectionStep';
import PlatformConfigurationStep from './onboarding/PlatformConfigurationStep';
import OfflineSetupStep, { OfflineStoreConfig } from './onboarding/OfflineSetupStep';
import StaffSetupStep from './onboarding/StaffSetupStep';
import PaymentProviderStep from './onboarding/PaymentProviderStep';
import PrinterSetupStep from './onboarding/PrinterSetupStep';
import ScannerSetupStep from './onboarding/ScannerSetupStep';
import AdminUserStep from './onboarding/AdminUserStep';
import POSSetupStep from './onboarding/POSSetupStep';
import type { POSSetupValues } from './onboarding/POSSetupStep';
import SummaryStep from './onboarding/SummaryStep';
import { posConfig } from '../services/config/POSConfigService';

type OnboardingStep =
  | 'welcome'
  | 'platform_selection'
  | 'platform_configuration'
  | 'offline_setup'
  | 'staff_setup'
  | 'pos_setup'
  | 'payment_provider_setup'
  | 'printer_setup'
  | 'scanner_setup'
  | 'admin_user'
  | 'summary';

const OnboardingScreen: React.FC = () => {
  const { setIsOnboarded } = useOnboardingContext();
  const { saveSettings, updateSettings: updateEcommerceSettings } = useEcommerceSettings();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [ecommerceConfig, setEcommerceConfig] = useState<any>({});
  const [offlineConfig, setOfflineConfig] = useState<OfflineStoreConfig>({
    storeName: '',
    categories: [],
    currency: 'GBP',
  });

  const isOffline = selectedPlatform === 'offline';

  const handleNextFromWelcome = () => {
    setCurrentStep('platform_selection');
  };

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    if (platformId === 'offline') {
      setCurrentStep('offline_setup');
    } else {
      setCurrentStep('platform_configuration');
    }
  };

  const handleBackToPlatformSelection = () => {
    setCurrentStep('platform_selection');
  };

  const handleNextFromPlatformConfig = async () => {
    if (selectedPlatform) {
      const newSettings = {
        enabled: true,
        platform: selectedPlatform,
        [selectedPlatform.toLowerCase()]: ecommerceConfig,
      };
      updateEcommerceSettings(newSettings);
      await saveSettings();
    }
    setCurrentStep('payment_provider_setup');
  };

  const handleNextFromOfflineSetup = async (config: OfflineStoreConfig) => {
    setOfflineConfig(config);
    const newSettings = {
      enabled: true,
      platform: 'offline',
      offline: {
        storeName: config.storeName,
        currency: config.currency,
        categories: config.categories,
      },
    };
    updateEcommerceSettings(newSettings);
    await saveSettings();
    // Go to admin user step first, then staff setup
    setCurrentStep('admin_user');
  };

  const handleNextFromAdminUserOffline = () => {
    setCurrentStep('staff_setup');
  };

  const handleNextFromStaffSetup = () => {
    setCurrentStep('payment_provider_setup');
  };

  const handleBackToPlatformConfig = () => {
    setCurrentStep('platform_configuration');
  };

  const handleNextFromPayment = () => {
    setCurrentStep('printer_setup');
  };

  const handleBackToPayment = () => {
    setCurrentStep('payment_provider_setup');
  };

  const handleNextFromPrinter = () => {
    setCurrentStep('scanner_setup');
  };

  const handleBackToPrinter = () => {
    setCurrentStep('printer_setup');
  };

  const handleNextFromScanner = () => {
    setCurrentStep('pos_setup');
  };

  const handleNextFromPOSSetup = async (values: POSSetupValues) => {
    await posConfig.updateAll({
      storeName: values.storeName,
      storeAddress: values.storeAddress,
      storePhone: values.storePhone,
      taxRate: parseFloat(values.taxRate) / 100,
      currencySymbol: values.currencySymbol,
      maxSyncRetries: parseInt(values.maxSyncRetries, 10) || 3,
      drawerOpenOnCash: values.drawerOpenOnCash,
    });
    setCurrentStep('admin_user');
  };

  const handleBackToPOSSetup = () => {
    setCurrentStep('pos_setup');
  };

  const handleBackToScanner = () => {
    setCurrentStep('scanner_setup');
  };

  const handleNextFromAdminUser = () => {
    if (isOffline) {
      setCurrentStep('staff_setup');
    } else {
      setCurrentStep('summary');
    }
  };

  const handleBackToAdminUser = () => {
    setCurrentStep('admin_user');
  };

  const handleOnboardingComplete = () => {
    // In a real app, we would save all the collected settings here.
    console.log('Onboarding complete!', { platform: selectedPlatform, config: ecommerceConfig });
    setIsOnboarded(true);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onNext={handleNextFromWelcome} />;
      case 'platform_selection':
        return <PlatformSelectionStep onSelectPlatform={handlePlatformSelect} />;
      case 'platform_configuration':
        if (selectedPlatform) {
          return (
            <PlatformConfigurationStep
              platformId={selectedPlatform}
              config={ecommerceConfig}
              setConfig={setEcommerceConfig}
              onBack={handleBackToPlatformSelection}
              onComplete={handleNextFromPlatformConfig}
            />
          );
        }
        return <WelcomeStep onNext={handleNextFromWelcome} />;
      case 'offline_setup':
        return (
          <OfflineSetupStep
            config={offlineConfig}
            setConfig={setOfflineConfig}
            onBack={handleBackToPlatformSelection}
            onComplete={handleNextFromOfflineSetup}
          />
        );
      case 'staff_setup':
        return <StaffSetupStep onBack={handleBackToAdminUser} onComplete={handleNextFromStaffSetup} />;
      case 'payment_provider_setup':
        return (
          <PaymentProviderStep
            onBack={isOffline ? () => setCurrentStep('staff_setup') : handleBackToPlatformConfig}
            onNext={handleNextFromPayment}
          />
        );
      case 'printer_setup':
        return <PrinterSetupStep onBack={handleBackToPayment} onNext={handleNextFromPrinter} />;
      case 'scanner_setup':
        return <ScannerSetupStep onBack={handleBackToPrinter} onComplete={handleNextFromScanner} />;
      case 'pos_setup':
        return <POSSetupStep onBack={handleBackToScanner} onComplete={handleNextFromPOSSetup} />;
      case 'admin_user':
        return (
          <AdminUserStep
            onBack={isOffline ? () => setCurrentStep('offline_setup') : handleBackToPOSSetup}
            onComplete={handleNextFromAdminUser}
          />
        );
      case 'summary':
        return <SummaryStep onBack={handleBackToAdminUser} onConfirm={handleOnboardingComplete} />;
      default:
        return <WelcomeStep onNext={handleNextFromWelcome} />;
    }
  };

  const STEP_LABELS = isOffline
    ? ['Welcome', 'Platform', 'Store Setup', 'Admin', 'Staff', 'Payment', 'Printer', 'Scanner', 'POS Config', 'Summary']
    : ['Welcome', 'Platform', 'Configure', 'Payment', 'Printer', 'Scanner', 'POS Config', 'Admin', 'Summary'];
  const STEP_ORDER: OnboardingStep[] = isOffline
    ? [
        'welcome',
        'platform_selection',
        'offline_setup',
        'admin_user',
        'staff_setup',
        'payment_provider_setup',
        'printer_setup',
        'scanner_setup',
        'pos_setup',
        'summary',
      ]
    : [
        'welcome',
        'platform_selection',
        'platform_configuration',
        'payment_provider_setup',
        'printer_setup',
        'scanner_setup',
        'pos_setup',
        'admin_user',
        'summary',
      ];
  const currentStepNumber = STEP_ORDER.indexOf(currentStep) + 1;

  return (
    <SafeAreaView style={styles.container}>
      {currentStep !== 'welcome' && (
        <View style={styles.progressContainer}>
          <ProgressIndicator currentStep={currentStepNumber} totalSteps={STEP_ORDER.length} labels={STEP_LABELS} />
        </View>
      )}
      {renderStep()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
});

export default OnboardingScreen;
