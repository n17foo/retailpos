import { useCallback, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { useLogger } from '../hooks/useLogger';
import { ECommercePlatform, DEFAULT_PLATFORM } from '../utils/platforms';
import { ServiceConfigBridge } from '../services/config/ServiceConfigBridge';

export interface ECommerceSettings {
  enabled: boolean;
  platform: string;
  apiUrl: string;
  apiKey: string;
  syncInventory: boolean;
  shopify: {
    apiKey: string;
    accessToken: string;
    storeUrl: string;
  };
  woocommerce: {
    apiKey: string;
    apiSecret: string;
    storeUrl: string;
  };
  magento: {
    accessToken: string;
    storeUrl: string;
    apiVersion: string;
  };
  bigcommerce: {
    clientId: string;
    accessToken: string;
    storeHash: string;
  };
  sylius: {
    apiToken: string;
    storeUrl: string;
    apiVersion: string;
  };
  wix: {
    apiKey: string;
    siteId: string;
    accountId: string;
  };
  prestashop: {
    apiKey: string;
    storeUrl: string;
  };
  squarespace: {
    apiKey: string;
    siteId: string;
  };
  offline: {
    menuUrl?: string;
    storeName: string;
    currency?: string;
    categories?: Array<{
      id: string;
      name: string;
      products: Array<{ id: string; name: string; price: string; sku?: string; barcode?: string }>;
    }>;
    lastSync?: string;
  };
}

// Default e-commerce settings
const DEFAULT_ECOMMERCE_SETTINGS: ECommerceSettings = {
  enabled: true,
  platform: DEFAULT_PLATFORM,
  apiUrl: '',
  apiKey: '',
  syncInventory: false,
  shopify: {
    apiKey: '',
    accessToken: '',
    storeUrl: '',
  },
  woocommerce: {
    apiKey: '',
    apiSecret: '',
    storeUrl: '',
  },
  magento: {
    accessToken: '',
    storeUrl: '',
    apiVersion: '',
  },
  bigcommerce: {
    clientId: '',
    accessToken: '',
    storeHash: '',
  },
  sylius: {
    apiToken: '',
    storeUrl: '',
    apiVersion: '',
  },
  wix: {
    apiKey: '',
    siteId: '',
    accountId: '',
  },
  prestashop: {
    apiKey: '',
    storeUrl: '',
  },
  squarespace: {
    apiKey: '',
    siteId: '',
  },
  offline: {
    storeName: '',
    currency: 'GBP',
    categories: [],
  },
};

/**
 * Custom hook for managing e-commerce settings
 * Provides a clean interface for e-commerce settings management
 */
export const useEcommerceSettings = () => {
  // E-commerce settings state
  const [ecommerceSettings, setEcommerceSettings] = useState<ECommerceSettings>(() => ({ ...DEFAULT_ECOMMERCE_SETTINGS }));

  // Local state to track if we have unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Add states to match useEcommerceConfig properties
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPlatform, setCurrentPlatform] = useState<ECommercePlatform | null>(DEFAULT_PLATFORM);

  // Track if we've already initialized
  const initialized = useRef(false);

  // Track if we're currently updating our state
  const isUpdating = useRef(false);

  // Store original settings for reset functionality
  const originalSettings = useRef({ ...DEFAULT_ECOMMERCE_SETTINGS });

  // Platform change management - decoupled from useEcommerceConfig

  // Initialize logger
  const logger = useLogger('useEcommerceSettings');

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      logger.info({ message: 'Loading e-commerce settings' });
      const settings = await keyValueRepository.getObject<ECommerceSettings>('ecommerceSettings');
      if (settings) {
        setEcommerceSettings(settings);
        originalSettings.current = { ...settings };
        logger.info({ message: 'E-commerce settings loaded successfully' });

        // Also load currentPlatform from storage to match useEcommerceConfig behavior
        const storedPlatform = await keyValueRepository.getItem('ecommercePlatform');
        if (storedPlatform) {
          setCurrentPlatform(storedPlatform as ECommercePlatform);
          setIsInitialized(true);
        }
      } else {
        logger.info({ message: 'No e-commerce settings found, using defaults' });
      }
      initialized.current = true;
      setIsLoading(false);
    } catch (error) {
      logger.error({ message: 'Failed to load e-commerce settings' }, error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handler for e-commerce settings changes
  const handleEcommerceSettingsChange = useCallback((newSettings: ECommerceSettings) => {
    setEcommerceSettings(newSettings);
    setHasUnsavedChanges(true);
  }, []);

  // Test connection to e-commerce platform
  const testConnection = useCallback(async () => {
    try {
      if (!ecommerceSettings.platform) {
        throw new Error('Please select an e-commerce platform');
      }

      if (!ecommerceSettings.enabled) {
        throw new Error('E-commerce is not enabled');
      }

      // Validate required fields based on platform
      if (ecommerceSettings.platform === 'shopify') {
        const storeUrl = ecommerceSettings.shopify?.storeUrl;
        const accessToken = ecommerceSettings.shopify?.accessToken || ecommerceSettings.apiKey;

        if (!storeUrl) {
          throw new Error('Shopify store URL is required');
        }
        if (!accessToken) {
          throw new Error('Shopify access token is required');
        }
      }

      logger.info({ message: 'Testing e-commerce connection', platform: ecommerceSettings.platform });

      // First save the current settings so they're available to the bridge
      await keyValueRepository.setObject<ECommerceSettings>('ecommerceSettings', ecommerceSettings);

      // Configure services from storage
      const configBridge = ServiceConfigBridge.getInstance();
      const configured = await configBridge.configureFromStorage();

      if (!configured) {
        throw new Error('Failed to configure services with current settings');
      }

      // Test the actual connection
      const result = await configBridge.testConnection();

      if (result.success) {
        Alert.alert('Success', result.message);
        return true;
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to the e-commerce platform';
      logger.error({ message: 'Connection test failed' }, error instanceof Error ? error : new Error(String(error)));
      Alert.alert('Connection Failed', errorMessage);
      return false;
    }
  }, [ecommerceSettings, logger]);

  // Save settings to storage
  const saveSettings = useCallback(async () => {
    try {
      logger.info({ message: 'Saving e-commerce settings' });
      await keyValueRepository.setObject<ECommerceSettings>('ecommerceSettings', ecommerceSettings);
      setHasUnsavedChanges(false);

      // Update platform state when saving settings
      if (ecommerceSettings.enabled && ecommerceSettings.platform) {
        // Store platform selection
        await keyValueRepository.setItem('ecommercePlatform', ecommerceSettings.platform);
        setCurrentPlatform(ecommerceSettings.platform as ECommercePlatform);
        setIsInitialized(true);
        logger.info({ message: 'E-commerce platform updated', platform: ecommerceSettings.platform });

        // Configure all service factories with the new settings
        const configBridge = ServiceConfigBridge.getInstance();
        const configured = await configBridge.configureFromStorage();
        if (configured) {
          logger.info({ message: 'Service factories configured successfully' });
        } else {
          logger.warn({ message: 'Some services may not be configured correctly' });
        }
      } else {
        // If disabled, clear platform and reset config bridge
        await keyValueRepository.removeItem('ecommercePlatform');
        setCurrentPlatform(null);
        setIsInitialized(false);
        ServiceConfigBridge.getInstance().reset();
      }

      logger.info({ message: 'E-commerce settings saved successfully' });
      Alert.alert('Success', 'Settings saved successfully');
      return true;
    } catch (error) {
      logger.error({ message: 'Failed to save e-commerce settings' }, error instanceof Error ? error : new Error(String(error)));
      Alert.alert('Error', 'Failed to save settings');
      return false;
    }
  }, [ecommerceSettings, logger]);

  // Reset to default settings
  const resetToDefaults = useCallback(() => {
    setEcommerceSettings({ ...DEFAULT_ECOMMERCE_SETTINGS });
    setHasUnsavedChanges(true);
  }, []);

  // Update local state and mark changes as unsaved
  const updateSettings = useCallback((updates: Partial<ECommerceSettings>) => {
    setEcommerceSettings(current => ({
      ...current,
      ...updates,
      ...(updates.shopify && {
        shopify: { ...current.shopify, ...updates.shopify },
      }),
      ...(updates.woocommerce && {
        woocommerce: { ...current.woocommerce, ...updates.woocommerce },
      }),
      ...(updates.magento && {
        magento: { ...current.magento, ...updates.magento },
      }),
      ...(updates.bigcommerce && {
        bigcommerce: { ...current.bigcommerce, ...updates.bigcommerce },
      }),
      ...(updates.sylius && {
        sylius: { ...current.sylius, ...updates.sylius },
      }),
      ...(updates.wix && {
        wix: { ...current.wix, ...updates.wix },
      }),
      ...(updates.prestashop && {
        prestashop: { ...current.prestashop, ...updates.prestashop },
      }),
      ...(updates.squarespace && {
        squarespace: { ...current.squarespace, ...updates.squarespace },
      }),
      ...(updates.offline && {
        offline: { ...current.offline, ...updates.offline },
      }),
    }));
    setHasUnsavedChanges(true);
  }, []);

  // Save changes to global state
  const saveChanges = useCallback(async () => {
    try {
      isUpdating.current = true;
      handleEcommerceSettingsChange(ecommerceSettings);
      await saveSettings();
      return true;
    } catch (error) {
      logger.error({ message: 'Failed to save changes' }, error instanceof Error ? error : new Error(String(error)));
      Alert.alert('Error', 'Failed to save changes');
      return false;
    } finally {
      isUpdating.current = false;
    }
  }, [ecommerceSettings, handleEcommerceSettingsChange, saveSettings]);

  // Cancel changes and revert to original settings
  const cancelChanges = useCallback(() => {
    setEcommerceSettings({ ...originalSettings.current });
    setHasUnsavedChanges(false);
  }, []);

  return {
    // State
    ecommerceSettings,
    hasUnsavedChanges,
    isInitialized,
    currentPlatform,
    isLoading,

    // State setters
    handleEcommerceSettingsChange,

    // Actions
    saveSettings,
    loadSettings,
    testConnection,

    // Reset functionality
    resetToDefaults,

    // Update and save changes
    updateSettings,
    saveChanges,
    cancelChanges,
  };
};
