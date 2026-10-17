/**
 * OnboardingScreen
 *
 * Minimal 3-phase onboarding wizard per docs/specs/onboarding/wizard.md §1A.
 *
 * Phases:
 *   1. platform_setup   — platform selection + credentials (or offline basics)
 *   2. admin_user_setup — create first admin user
 *   3. peripherals_setup — printer / scanner / payment terminal (skippable)
 *
 * All non-critical setup is deferred to More → Settings after first login.
 * Setup progress is persisted via SetupProgressService so deferred tasks
 * surface as reminders in the More menu.
 *
 * Legacy step names (welcome, staff_setup, pos_setup, auth_method_setup,
 * summary) are deprecated per spec §1.9 and are no longer part of the
 * mandatory onboarding path.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboardingContext } from '../contexts/OnboardingProvider';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { spacing } from '../utils/theme';
import { useTranslate } from '../hooks/useTranslate';
import { setupProgressService } from '../services/setup/SetupProgressService';
import { platformCapabilityService } from '../services/platform/PlatformCapabilityService';
import { posConfig } from '../services/config/POSConfigService';
import { offlineCategoryService } from '../services/category/platforms/OfflineCategoryService';
import { offlineProductService } from '../services/product/platforms/OfflineProductService';
import { getCurrencySymbol } from '../utils/currency';
import { useLogger } from '../hooks/useLogger';

// Step components — reused from existing onboarding screens
import PlatformSelectionStep from './onboarding/PlatformSelectionStep';
import PlatformConfigurationStep from './onboarding/PlatformConfigurationStep';
import OfflineSetupStep, { OfflineStoreConfig } from './onboarding/OfflineSetupStep';
import AdminUserStep from './onboarding/AdminUserStep';
import PrinterSetupStep from './onboarding/PrinterSetupStep';
import ScannerSetupStep from './onboarding/ScannerSetupStep';
import PaymentProviderStep from './onboarding/PaymentProviderStep';

/**
 * The three mandatory onboarding phases.
 * Sub-steps within each phase are handled internally.
 */
type OnboardingPhase =
  | 'platform_setup' // Phase 1: platform selection + credentials
  | 'admin_user_setup' // Phase 2: create first admin user
  | 'peripherals_setup'; // Phase 3: printer / scanner / payment (skippable)

/**
 * Sub-steps within the platform_setup phase.
 * Kept internal to avoid polluting the phase type.
 */
type PlatformSubStep = 'platform_selection' | 'platform_configuration' | 'offline_setup';

/**
 * Sub-steps within the peripherals_setup phase.
 */
type PeripheralsSubStep = 'payment' | 'printer' | 'scanner';

/**
 * Generate deferred feature keys based on platform capabilities.
 * Only defer features that are actually supported by the selected platform.
 * Always defer core setup features regardless of platform.
 */
const getDeferredFeatures = (_platform: string): string[] => {
  const capabilities = platformCapabilityService.getCapabilities();
  const deferred: string[] = [];

  // Defer platform-specific features only if they're supported or available via custom adapter
  if (capabilities.discounts === 'supported' || capabilities.discounts === 'custom') {
    deferred.push('discounts');
  }
  if (capabilities.giftCards === 'supported' || capabilities.giftCards === 'custom') {
    deferred.push('giftcards');
  }
  if (capabilities.refunds === 'supported' || capabilities.refunds === 'custom') {
    deferred.push('refunds');
  }
  if (capabilities.loyalty === 'supported' || capabilities.loyalty === 'custom') {
    deferred.push('loyalty');
  }
  if (capabilities.storeCredit === 'supported' || capabilities.storeCredit === 'custom') {
    deferred.push('store_credit');
  }

  // Always defer these core setup features regardless of platform
  deferred.push('staff', 'pos_config', 'auth_methods');

  return deferred;
};

const OnboardingScreen: React.FC = () => {
  const { t } = useTranslate();
  const { setIsOnboarded } = useOnboardingContext();
  const { saveSettings, updateSettings: updateEcommerceSettings } = useEcommerceSettings();
  const logger = useLogger('OnboardingScreen');

  // Phase-level state
  const [currentPhase, setCurrentPhase] = useState<OnboardingPhase>('platform_setup');

  // Sub-step within platform_setup
  const [platformSubStep, setPlatformSubStep] = useState<PlatformSubStep>('platform_selection');

  // Platform data collected in phase 1
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [ecommerceConfig, setEcommerceConfig] = useState<Record<string, string>>({});
  const [offlineConfig, setOfflineConfig] = useState<OfflineStoreConfig>({
    storeName: '',
    storeAddress: '',
    categories: [],
    currency: 'GBP',
  });

  // ─── Phase 1: Platform setup ────────────────────────────────────────────────

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    if (platformId === 'offline') {
      setPlatformSubStep('offline_setup');
    } else {
      setPlatformSubStep('platform_configuration');
    }
  };

  const handleBackToPlatformSelection = () => {
    setPlatformSubStep('platform_selection');
  };

  const handlePlatformConfigComplete = async () => {
    if (selectedPlatform) {
      const newSettings = {
        enabled: true,
        platform: selectedPlatform,
        [selectedPlatform.toLowerCase()]: ecommerceConfig,
      };
      updateEcommerceSettings(newSettings);
      await saveSettings();
      platformCapabilityService.setPlatform(selectedPlatform as Parameters<typeof platformCapabilityService.setPlatform>[0]);
    }
    await setupProgressService.completePhase('platform');
    setCurrentPhase('admin_user_setup');
  };

  const handleOfflineSetupComplete = async (config: OfflineStoreConfig) => {
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
    platformCapabilityService.setPlatform('offline');
    // Store location is the tax destination for offline sales (D10).
    await posConfig.updateAll({
      storeName: config.storeName.trim(),
      storeAddress: config.storeAddress.trim(),
      currencySymbol: getCurrencySymbol(config.currency),
    });
    // Seed the offline catalogue so the categories/products entered here
    // actually appear on the sale screen. Offline category matching is by
    // name via productType (see utils/categoryFilter.ts).
    for (const category of config.categories) {
      try {
        await offlineCategoryService.addCategory({ name: category.name });
        for (const product of category.products) {
          await offlineProductService.createProduct({
            id: '',
            title: product.name,
            productType: category.name,
            variants: [
              {
                id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                title: 'Default',
                sku: product.sku,
                barcode: product.barcode,
                price: parseFloat(product.price) || 0,
                inventoryQuantity: 0,
              },
            ],
          });
        }
      } catch (err) {
        logger.error({ message: `Failed to seed offline category: ${category.name}` }, err instanceof Error ? err : new Error(String(err)));
      }
    }
    await setupProgressService.completePhase('platform');
    setCurrentPhase('admin_user_setup');
  };

  // ─── Phase 2: Admin user setup ──────────────────────────────────────────────

  const handleAdminUserComplete = async () => {
    await setupProgressService.completePhase('user');
    setCurrentPhase('peripherals_setup');
  };

  const handleBackToAdminUser = () => {
    setCurrentPhase('admin_user_setup');
  };

  // ─── Phase 3: Peripherals setup ─────────────────────────────────────────────

  // Peripherals are split into sub-steps: payment → printer → scanner
  const [peripheralsSubStep, setPeripheralsSubStep] = useState<PeripheralsSubStep>('payment');

  const handlePaymentComplete = () => setPeripheralsSubStep('printer');
  const handlePrinterComplete = () => setPeripheralsSubStep('scanner');
  const handlePrinterSkip = () => setPeripheralsSubStep('scanner');

  const handlePeripheralsComplete = async () => {
    await setupProgressService.completePhase('peripherals');
    await completeOnboarding();
  };

  const handlePeripheralsSkip = async () => {
    // Peripherals skipped — defer to More → Settings
    await setupProgressService.completePhase('peripherals');
    await completeOnboarding();
  };

  // ─── Onboarding completion ───────────────────────────────────────────────────

  const completeOnboarding = async () => {
    logger.info('Onboarding complete', { platform: selectedPlatform });
    const deferredFeatures = getDeferredFeatures(selectedPlatform || 'offline');
    await setupProgressService.markOnboardingComplete(deferredFeatures);
    setIsOnboarded(true);
  };

  // ─── Progress indicator ──────────────────────────────────────────────────────

  const PHASE_ORDER: OnboardingPhase[] = ['platform_setup', 'admin_user_setup', 'peripherals_setup'];
  const currentPhaseNumber = PHASE_ORDER.indexOf(currentPhase) + 1;

  const PHASE_LABELS = [t('onboarding.steps.platform'), t('onboarding.steps.admin'), t('onboarding.steps.peripherals')];

  // ─── Render ──────────────────────────────────────────────────────────────────

  const renderPhase = () => {
    switch (currentPhase) {
      case 'platform_setup':
        switch (platformSubStep) {
          case 'platform_selection':
            return <PlatformSelectionStep onSelectPlatform={handlePlatformSelect} />;

          case 'platform_configuration':
            return selectedPlatform ? (
              <PlatformConfigurationStep
                platformId={selectedPlatform}
                config={ecommerceConfig}
                setConfig={setEcommerceConfig}
                onBack={handleBackToPlatformSelection}
                onComplete={handlePlatformConfigComplete}
              />
            ) : (
              <PlatformSelectionStep onSelectPlatform={handlePlatformSelect} />
            );

          case 'offline_setup':
            return (
              <OfflineSetupStep
                config={offlineConfig}
                setConfig={setOfflineConfig}
                onBack={handleBackToPlatformSelection}
                onComplete={handleOfflineSetupComplete}
              />
            );
        }
        break;

      case 'admin_user_setup':
        return (
          <AdminUserStep
            onBack={() => {
              // Back to platform setup — reset to selection
              setPlatformSubStep('platform_selection');
              setCurrentPhase('platform_setup');
            }}
            onComplete={handleAdminUserComplete}
          />
        );

      case 'peripherals_setup':
        switch (peripheralsSubStep) {
          case 'payment':
            return <PaymentProviderStep onBack={handleBackToAdminUser} onNext={handlePaymentComplete} />;
          case 'printer':
            return (
              <PrinterSetupStep onBack={() => setPeripheralsSubStep('payment')} onNext={handlePrinterComplete} onSkip={handlePrinterSkip} />
            );
          case 'scanner':
            return (
              <ScannerSetupStep
                onBack={() => setPeripheralsSubStep('printer')}
                onComplete={handlePeripheralsComplete}
                onSkip={handlePeripheralsSkip}
              />
            );
        }
        break;
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        <ProgressIndicator currentStep={currentPhaseNumber} totalSteps={PHASE_ORDER.length} labels={PHASE_LABELS} />
      </View>
      {renderPhase()}
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
