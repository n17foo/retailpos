import React, { useState } from 'react';
import { SafeAreaView, View, StyleSheet } from 'react-native';
import { useOnboardingContext } from '../contexts/OnboardingProvider';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { spacing } from '../utils/theme';

import WelcomeStep from './onboarding/WelcomeStep';
import PlatformSelectionStep from './onboarding/PlatformSelectionStep';
import PlatformConfigurationStep from './onboarding/PlatformConfigurationStep';
import PaymentProviderStep from './onboarding/PaymentProviderStep';
import PrinterSetupStep from './onboarding/PrinterSetupStep';
import ScannerSetupStep from './onboarding/ScannerSetupStep';
import AdminUserStep from './onboarding/AdminUserStep';
import SummaryStep from './onboarding/SummaryStep';

type OnboardingStep =
  | 'welcome'
  | 'platform_selection'
  | 'platform_configuration'
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

  const handleNextFromWelcome = () => {
    setCurrentStep('platform_selection');
  };

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    setCurrentStep('platform_configuration');
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
      // updateEcommerceSettings is not async, it just updates the state
      updateEcommerceSettings(newSettings);
      await saveSettings(); // saveSettings is async and saves the current state
    }
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
    setCurrentStep('admin_user');
  };

  const handleBackToScanner = () => {
    setCurrentStep('scanner_setup');
  };

  const handleNextFromAdminUser = () => {
    setCurrentStep('summary');
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
        // Fallback in case platform is not selected
        return <WelcomeStep onNext={handleNextFromWelcome} />;
      case 'payment_provider_setup':
        return <PaymentProviderStep onBack={handleBackToPlatformConfig} onNext={handleNextFromPayment} />;
      case 'printer_setup':
        return <PrinterSetupStep onBack={handleBackToPayment} onNext={handleNextFromPrinter} />;
      case 'scanner_setup':
        return <ScannerSetupStep onBack={handleBackToPrinter} onComplete={handleNextFromScanner} />;
      case 'admin_user':
        return <AdminUserStep onBack={handleBackToScanner} onComplete={handleNextFromAdminUser} />;
      case 'summary':
        return <SummaryStep onBack={handleBackToAdminUser} onConfirm={handleOnboardingComplete} />;
      default:
        return <WelcomeStep onNext={handleNextFromWelcome} />;
    }
  };

  const STEP_LABELS = ['Welcome', 'Platform', 'Configure', 'Payment', 'Printer', 'Scanner', 'Admin User', 'Summary'];
  const STEP_ORDER: OnboardingStep[] = [
    'welcome',
    'platform_selection',
    'platform_configuration',
    'payment_provider_setup',
    'printer_setup',
    'scanner_setup',
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
