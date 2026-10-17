import React, { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, I18nManager } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { I18nextProvider } from 'react-i18next';
import * as Localization from 'expo-localization';
import i18n, { SUPPORTED_LANGUAGE_CODES, LanguageCode } from './shared/locales/i18n';
import { CategoryProvider } from './features/catalogue/contexts/CategoryProvider';
import { BasketStateProvider } from './features/basket/contexts/BasketStateProvider';
import { BasketActionsProvider } from './features/basket/contexts/BasketActionsProvider';
import { CheckoutProvider } from './features/checkout/contexts/CheckoutProvider';
import { AuthProvider } from './features/authentication/contexts/AuthProvider';
import { OnboardingProvider } from './features/onboarding/contexts/OnboardingProvider';
import { DataProvider } from './app/providers/DataProvider';
import { SettingsProvider } from './features/settings/contexts/SettingsProvider';
import { ThemeProvider } from './shared/contexts/ThemeProvider';
import { useLogger } from './shared/hooks/useLogger';
import { useTranslate } from './shared/hooks/useTranslate';
import { lightColors } from './shared/utils/theme';
import { queueManager } from './shared/services/queue/QueueManager';
import { backgroundSyncService } from './features/orders-sync/services/sync/BackgroundSyncService';
import { loyaltyExpiryJob } from './features/customers/services/loyalty/LoyaltyExpiryJob';
import { posConfig } from './features/platform-clients/services/config/POSConfigService';
import { authConfig } from './features/authentication/services/auth/AuthConfigService';
import { instoreApiConfig } from './features/multi-register/services/InstoreApiConfig';
import { instoreApiServer } from './features/multi-register/services/InstoreApiServer';
import { syncPoller } from './features/multi-register/services/sync/SyncPoller';
import { storeApiConnectionManager } from './features/multi-register/services/websocket/StoreApiConnectionManager';
import RootNavigator from './app/navigation/RootNavigator';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { NotificationProvider, useNotifications } from './shared/contexts/NotificationProvider';
import Toast from './shared/components/Toast';
import { ManagerApprovalModal } from './features/authentication/components/ManagerApprovalModal';
import { StripeTerminalBridgeProvider } from './features/payments/contexts/StripeTerminalBridge';

const AppContent = () => {
  const { changeLanguage } = useTranslate();
  const logger = useLogger('AppContent');

  // Stable refs so the mount-only effect always calls the latest versions
  // without needing them in the dependency array (which would cause re-runs)
  const changeLanguageRef = useRef(changeLanguage);
  const loggerRef = useRef(logger);
  changeLanguageRef.current = changeLanguage;
  loggerRef.current = logger;

  // Handle language changes when app starts or locale changes
  useEffect(() => {
    let isMounted = true;

    const handleLocalizationChange = async () => {
      try {
        loggerRef.current.info({ message: '[Localization] Starting localization change handler' });
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

        loggerRef.current.info({ message: `[Localization] Using locale: ${locale}, languageTag: ${currentLocaleTag}` });

        if (isMounted) {
          // Check for RTL using the full language tag
          const isRTL =
            currentLocaleTag.startsWith('ar') || // Arabic
            currentLocaleTag.startsWith('he') || // Hebrew
            currentLocaleTag.startsWith('fa'); // Farsi

          I18nManager.forceRTL(!!isRTL);

          // Change language if supported
          if (SUPPORTED_LANGUAGE_CODES.includes(locale as LanguageCode)) {
            await changeLanguageRef.current(locale);
          }
        }
      } catch (error) {
        loggerRef.current.error(
          { message: '[Localization] Error handling localization change' },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    };

    // Initial setup
    handleLocalizationChange().catch(error => {
      loggerRef.current.error(
        { message: '[Localization] Failed to handle localization change' },
        error instanceof Error ? error : new Error(String(error))
      );
    });

    // Load dynamic POS config from settings DB (tax rate, store info, etc.)
    posConfig.load().catch(err => {
      loggerRef.current.error(
        { message: 'Failed to load POS config — using defaults' },
        err instanceof Error ? err : new Error(String(err))
      );
    });

    // Load auth method config (primary method, allowed methods)
    authConfig.load().catch(err => {
      loggerRef.current.error(
        { message: 'Failed to load auth config — using PIN default' },
        err instanceof Error ? err : new Error(String(err))
      );
    });

    // Load local API config and start services based on mode
    instoreApiConfig
      .load()
      .then(async () => {
        if (instoreApiConfig.isClient) {
          syncPoller.start();
          loggerRef.current.info({ message: 'SyncPoller started — client mode active' });
        } else if (instoreApiConfig.isServer) {
          try {
            await instoreApiServer.start();
            loggerRef.current.info({ message: 'InstoreApiServer started — server mode active' });
          } catch (error) {
            loggerRef.current.error(
              { message: 'Failed to start InstoreApiServer' },
              error instanceof Error ? error : new Error(String(error))
            );
          }
        }

        // Start WebSocket connection to store-api for real-time outbox delivery
        // (payment events, order updates, etc.). The connection manager handles
        // its own fallback to SyncPoller if the WebSocket is unavailable.
        if (instoreApiConfig.isMultiRegister) {
          storeApiConnectionManager.start().catch(err => {
            loggerRef.current.error(
              { message: 'Failed to start StoreApiConnectionManager' },
              err instanceof Error ? err : new Error(String(err))
            );
          });
        }
      })
      .catch(err => {
        loggerRef.current.error({ message: 'Failed to load local API config' }, err instanceof Error ? err : new Error(String(err)));
      });

    // Initialize sync queue manager
    queueManager.initialize();

    // Start background sync service for retrying failed order syncs
    backgroundSyncService.start(300000); // Check every 5 minutes

    // Start loyalty points expiry job (runs on foreground transitions, ≥24h apart)
    loyaltyExpiryJob.start();

    // Cleanup
    return () => {
      isMounted = false;
      backgroundSyncService.stop();
      loyaltyExpiryJob.stop();
      queueManager.dispose();
      syncPoller.stop();
      storeApiConnectionManager.stop().catch(() => {}); // Don't throw on cleanup
      instoreApiServer.stop().catch(() => {}); // Don't throw on cleanup
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ErrorBoundary>
        <NotificationProvider>
          <OnboardingProvider>
            <StripeTerminalBridgeProvider>
              <AuthProvider>
                <BasketStateProvider>
                  <BasketActionsProvider>
                    <CheckoutProvider>
                      <CategoryProvider>
                        <SettingsProvider>
                          <DataProvider>
                            <RootNavigator />
                          </DataProvider>
                        </SettingsProvider>
                      </CategoryProvider>
                    </CheckoutProvider>
                  </BasketActionsProvider>
                </BasketStateProvider>
              </AuthProvider>
            </StripeTerminalBridgeProvider>
          </OnboardingProvider>
          <AppToast />
          <ManagerApprovalModal />
        </NotificationProvider>
      </ErrorBoundary>
    </SafeAreaView>
  );
};

/** Renders the global toast from NotificationProvider */
const AppToast: React.FC = () => {
  const { latestToast, dismissToast } = useNotifications();
  if (!latestToast) return null;
  return <Toast notification={latestToast} onDismiss={dismissToast} />;
};

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider>
            <AppContent />
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
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
