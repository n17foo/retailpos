import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, SafeAreaView, I18nManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';
import * as Localization from 'expo-localization';
import i18n from './locales/i18n';
import { CategoryProvider } from './contexts/CategoryProvider';
import { BasketProvider } from './contexts/BasketProvider';
import { AuthProvider } from './contexts/AuthProvider';
import { OnboardingProvider } from './contexts/OnboardingProvider';
import { DataProvider } from './contexts/DataProvider';
import { SettingsProvider } from './contexts/SettingsProvider';
import { RootNavigator } from './navigation';
import { logger } from './services/logger';
import { useTranslate } from './hooks/useTranslate';
import { lightColors } from './utils/theme';
import { queueManager } from './services/queue/QueueManager';
import { backgroundSyncService } from './services/sync/BackgroundSyncService';
//import { StripeTerminalBridgeProvider } from './contexts/StripeTerminalBridge';

const AppContent = () => {
  const { changeLanguage } = useTranslate();

  // Handle language changes when app starts or locale changes
  useEffect(() => {
    let isMounted = true;

    const handleLocalizationChange = async () => {
      try {
        logger.info({ message: '[Localization] Starting localization change handler' });
        const defaultLocale = 'en';
        let locale = defaultLocale;
        let currentLocaleTag = defaultLocale; // For RTL check

        // getLocales() returns an array of Locale objects
        const deviceLocales = Localization.getLocales?.();

        if (Array.isArray(deviceLocales) && deviceLocales.length > 0) {
          const firstLocale = deviceLocales[0];
          // Use languageCode directly to avoid splitting. It's the "en" part of "en-US".
          if (firstLocale && typeof firstLocale.languageCode === 'string' && firstLocale.languageCode) {
            locale = firstLocale.languageCode;
          }
          // Use languageTag for the RTL check.
          if (firstLocale && typeof firstLocale.languageTag === 'string' && firstLocale.languageTag) {
            currentLocaleTag = firstLocale.languageTag;
          }
        }

        logger.info({ message: `[Localization] Using locale: ${locale}, languageTag: ${currentLocaleTag}` });

        if (isMounted) {
          // Check for RTL using the full language tag
          const isRTL =
            currentLocaleTag.startsWith('ar') || // Arabic
            currentLocaleTag.startsWith('he') || // Hebrew
            currentLocaleTag.startsWith('fa'); // Farsi

          I18nManager.forceRTL(!!isRTL);

          // Change language if supported
          if (['en', 'fr', 'de'].includes(locale)) {
            await changeLanguage(locale);
          }
        }
      } catch (error) {
        logger.error(
          { message: '[Localization] Error handling localization change' },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    };

    // Initial setup
    handleLocalizationChange().catch(error => {
      logger.error(
        { message: '[Localization] Failed to handle localization change' },
        error instanceof Error ? error : new Error(String(error))
      );
    });

    // Initialize sync queue manager
    queueManager.initialize();

    // Start background sync service for retrying failed order syncs
    backgroundSyncService.start(300000); // Check every 5 minutes

    // Cleanup
    return () => {
      isMounted = false;
      backgroundSyncService.stop();
      queueManager.dispose();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <OnboardingProvider>
        <AuthProvider>
          <BasketProvider>
            <CategoryProvider>
              <SettingsProvider>
                <DataProvider>
                  <RootNavigator />
                </DataProvider>
              </SettingsProvider>
            </CategoryProvider>
          </BasketProvider>
        </AuthProvider>
      </OnboardingProvider>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <I18nextProvider i18n={i18n}>
        <AppContent />
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
});
