/**
 * StripeTerminalBridgeImpl — the real Stripe Terminal provider.
 *
 * This module has a top-level dependency on `@stripe/stripe-terminal-react-native`,
 * whose native module does not exist in Expo Go (or on web/Electron). It must
 * therefore NEVER be statically imported — `contexts/StripeTerminalBridge.tsx`
 * loads it via a conditional `require()` only on real iOS/Android builds.
 */

import React, { useState, useEffect, ReactNode, useMemo } from 'react';
import { StripeTerminalProvider, useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { useLogger } from '../../../shared/hooks/useLogger';
import { isDevelopmentRuntime } from '../../../shared/utils/mockFlags';
import { PaymentSettingsStorage } from '../../platform-clients/services/config/PaymentSettingsStorage';
import { cancelStripePayment, createStripePaymentIntent, createStripeRefund, fetchStripeConnectionToken } from '../services/stripeBackend';
import { StripeTerminalBridgeContext, StripeTerminalBridgeManager } from './StripeTerminalBridge';
import type { Reader, CommonError, StripeTerminalBridgeState, StripeTerminalBridgeActions } from './StripeTerminalBridge';

export const StripeTerminalBridgeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StripeTerminalBridgeState>({
    initialized: false,
    isConnecting: false,
    isProcessingPayment: false,
    connectedReader: null,
    discoveredReaders: [],
    lastError: null,
  });
  const logger = useLogger('StripeTerminalBridge');

  // Token provider function
  const fetchTokenProvider = async () => {
    try {
      const locationId = (await keyValueRepository.getItem('stripe_nfc_merchantId')) || '';

      // Direct-API mode (secret key on the register as the connection token)
      // is a development convenience only — production must go through the
      // merchant's backend, which holds the secret key (PAY-03).
      const useDirectApi = isDevelopmentRuntime() && (await keyValueRepository.getItem('stripe_nfc_useDirectApi')) === 'true';
      if (useDirectApi) {
        const apiKey = (await PaymentSettingsStorage.getStripeNfcApiKey()) || '';
        if (!apiKey) {
          throw new Error('Stripe API key not configured');
        }
        logger.info('Using direct API for Stripe Terminal token (development only)');
        return apiKey;
      }

      logger.info('Fetching Stripe Terminal connection token from backend');
      return await fetchStripeConnectionToken(locationId);
    } catch (error) {
      logger.error('Failed to fetch Stripe connection token:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  // This component uses the Stripe Terminal Provider and hook
  const StripeTerminalBridgeContent = () => {
    // Use the Stripe Terminal hook to get SDK functions
    // Access the terminal instance - casting as any to avoid TypeScript errors
    // with the beta SDK which has incomplete TypeScript definitions
    const terminal = useStripeTerminal({
      onUpdateDiscoveredReaders: readers => {
        setState(prev => ({ ...prev, discoveredReaders: readers }));
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe Terminal SDK has incomplete TypeScript definitions
    }) as any;

    const {
      initialize,
      _discoverReaders,
      _collectPaymentMethod,
      _processPayment,
      _cancelPaymentIntent,
      connectedReader,
      _discoveredReaders,
      _disconnectReader,
    } = terminal;

    // Initialize once on component mount
    useEffect(() => {
      const initializeSDK = async () => {
        try {
          const { error } = await initialize();
          if (error) {
            throw error;
          }
          setState(prev => ({ ...prev, initialized: true }));
        } catch (e) {
          const error = e as CommonError;
          setState(prev => ({
            ...prev,
            initialized: false,
            lastError: error.message || 'Failed to initialize Stripe Terminal',
          }));
        }
      };

      initializeSDK();
    }, [initialize]);

    // Update state when reader connection changes
    useEffect(() => {
      setState(prev => ({ ...prev, connectedReader }));
    }, [connectedReader]);

    // Define the bridge actions
    const bridgeActions: StripeTerminalBridgeActions = useMemo(
      () => ({
        initialize: async () => {
          try {
            if (!terminal || !terminal.initialize) {
              setState(prev => ({
                ...prev,
                lastError: 'Terminal SDK not available',
                initialized: false,
              }));
              return false;
            }

            const { error, reader } = await terminal.initialize();

            if (error) {
              setState(prev => ({
                ...prev,
                lastError: error.message || 'Unknown initialization error',
                initialized: false,
              }));
              return false;
            }

            setState(prev => ({
              ...prev,
              initialized: true,
              connectedReader: reader || null,
            }));

            return true;
          } catch (e) {
            const error = e as Error;
            setState(prev => ({ ...prev, lastError: error.message, initialized: false }));
            return false;
          }
        },

        discoverReaders: async ({ discoveryMethod, simulated = false }) => {
          try {
            if (!terminal || !terminal.discoverReaders) {
              throw new Error('Stripe Terminal SDK not properly initialized');
            }

            if (!state.initialized) {
              const success = await bridgeActions.initialize();
              if (!success) {
                throw new Error('Failed to initialize Stripe Terminal');
              }
            }

            logger.info(`Starting reader discovery: ${discoveryMethod}${simulated ? ' (simulated)' : ''}`);
            setState(prev => ({ ...prev, discoveredReaders: [], lastError: null }));

            // Get timeout from settings
            const timeoutStr = (await keyValueRepository.getItem('stripe_nfc_connectionTimeout')) || '30';
            const timeout = parseInt(timeoutStr, 10) * 1000; // Convert to milliseconds

            // Construct proper configuration for reader discovery
            const config: Record<string, unknown> = {
              discoveryMethod,
              simulated,
            };

            // Add timeout to configuration if valid
            if (timeout && !isNaN(timeout)) {
              config.timeout = timeout;
            }

            // If using simulated reader, ensure we're using the correct discovery method
            if (simulated) {
              config.discoveryMethod = 'simulated';
            }

            logger.info('Starting reader discovery with config:', config);

            // Start discovery using the terminal object
            const result = await terminal.discoverReaders(config);
            logger.info('Reader discovery result:', result);

            if (result.error) {
              throw new Error(result.error.message || 'Failed to discover readers');
            }

            // Return the current list of discovered readers
            // The full list will be updated via the onUpdateDiscoveredReaders callback
            return terminal.discoveredReaders || [];
          } catch (e) {
            const error = e as Error;
            logger.error('Reader discovery error:', error);
            setState(prev => ({ ...prev, lastError: error.message }));
            return [];
          }
        },

        connectToReader: async readerId => {
          try {
            if (!terminal || !terminal.connectBluetoothReader) {
              setState(prev => ({
                ...prev,
                lastError: 'Terminal SDK not available',
                isConnecting: false,
              }));
              return false;
            }

            setState(prev => ({ ...prev, isConnecting: true }));
            // Make sure we have a location ID for the reader
            const locationId = (await keyValueRepository.getItem('stripe_nfc_locationId')) || '';
            if (!locationId) {
              throw new Error('Stripe location ID is not configured');
            }

            // Find the reader from discovered readers
            const targetReader = terminal.discoveredReaders.find((r: Reader) => r.serialNumber === readerId);
            if (!targetReader) {
              throw new Error(`Reader ${readerId} not found`);
            }

            const { error } = await terminal.connectBluetoothReader({
              serialNumber: targetReader.serialNumber,
              locationId,
            });

            if (error) {
              throw new Error(error.message || 'Failed to connect to reader');
            }

            setState(prev => ({
              ...prev,
              isConnecting: false,
              connectedReader: terminal.connectedReader,
            }));
            return true;
          } catch (e) {
            const error = e as Error;
            setState(prev => ({
              ...prev,
              isConnecting: false,
              lastError: error.message,
            }));
            return false;
          }
        },

        disconnectReader: async () => {
          try {
            if (!terminal || !terminal.disconnectReader) {
              setState(prev => ({
                ...prev,
                lastError: 'Terminal SDK not available',
              }));
              return false;
            }

            const { error } = await terminal.disconnectReader();

            if (error) {
              setState(prev => ({
                ...prev,
                lastError: error.message || 'Failed to disconnect reader',
              }));
              return false;
            }

            setState(prev => ({ ...prev, connectedReader: null }));
            return true;
          } catch (e) {
            const error = e as Error;
            setState(prev => ({ ...prev, lastError: error.message }));
            return false;
          }
        },

        processPayment: async ({ amount, currency = 'usd', description, metadata = {} }) => {
          try {
            if (!terminal || !terminal.collectPaymentMethod || !terminal.processPayment) {
              setState(prev => ({
                ...prev,
                lastError: 'Terminal SDK not available',
              }));
              return {
                success: false,
                errorMessage: 'Terminal SDK not available',
                errorCode: 'terminal_unavailable',
                timestamp: new Date(),
              };
            }

            // Update UI state
            setState(prev => ({ ...prev, isProcessingPayment: true }));
            logger.info(`Processing payment: $${amount} ${currency} - ${description}`);

            // PaymentIntents are created by the merchant's backend, which
            // holds the secret key. The legacy direct-API path (secret key on
            // the register) is kept for development builds only (PAY-03).
            const useDirectApi = isDevelopmentRuntime() && (await keyValueRepository.getItem('stripe_nfc_useDirectApi')) === 'true';
            let paymentIntent;

            if (useDirectApi) {
              const apiKey = (await PaymentSettingsStorage.getStripeNfcApiKey()) || '';
              if (!apiKey) {
                throw new Error('Stripe API key not configured');
              }

              // Create payment intent directly with Stripe API
              const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: new URLSearchParams({
                  amount: Math.round(amount * 100).toString(), // Convert dollars to cents
                  currency: currency,
                  description: description,
                  'metadata[reference]': metadata.reference || '',
                  'metadata[orderId]': metadata.orderId || '',
                  'metadata[customerName]': metadata.customerName || '',
                  'payment_method_types[]': 'card_present',
                }).toString(),
              });

              if (!stripeResponse.ok) {
                const errorData = await stripeResponse.json();
                throw new Error(errorData.error?.message || `Stripe API error: ${stripeResponse.status}`);
              }

              paymentIntent = await stripeResponse.json();
            } else {
              paymentIntent = await createStripePaymentIntent({ amount, currency, description, metadata });
            }

            if (!paymentIntent || !paymentIntent.id) {
              throw new Error('Failed to create payment intent');
            }

            // Collect payment method
            logger.info('Collecting payment method...');
            const { error: collectError } = await terminal.collectPaymentMethod({
              paymentIntentId: paymentIntent.id,
            });

            if (collectError) {
              // Check for specific error types
              if (collectError.code === 'card_declined') {
                return {
                  success: false,
                  errorMessage: 'Card was declined',
                  errorCode: 'card_declined',
                  timestamp: new Date(),
                };
              } else if (collectError.code === 'cancelled') {
                return {
                  success: false,
                  errorMessage: 'Payment was cancelled',
                  errorCode: 'cancelled',
                  timestamp: new Date(),
                };
              }

              throw new Error(collectError.message || 'Failed to collect payment method');
            }

            // Process payment
            logger.info('Processing payment...');
            const { error: processError, paymentIntent: processedIntent } = await terminal.processPayment();

            if (processError) {
              // Handle specific payment processing errors
              if (processError.code === 'card_declined') {
                return {
                  success: false,
                  errorMessage: 'Card was declined',
                  errorCode: 'card_declined',
                  timestamp: new Date(),
                };
              }
              throw new Error(processError.message || 'Failed to process payment');
            }

            if (!processedIntent) {
              throw new Error('No payment intent returned after processing');
            }

            // Update UI state
            setState(prev => ({ ...prev, isProcessingPayment: false }));

            // Extract card details if available
            let cardBrand, last4, paymentMethod;
            if (processedIntent.charges?.data?.[0]) {
              const charge = processedIntent.charges.data[0];
              cardBrand = charge.payment_method_details?.card_present?.brand || charge.payment_method_details?.type || 'unknown';
              last4 = charge.payment_method_details?.card_present?.last4 || 'xxxx';
              paymentMethod = 'contactless';
            }

            // Return success response with all available information
            return {
              success: true,
              transactionId: processedIntent.id,
              receiptNumber: `RCPT-${processedIntent.id.slice(-6)}`,
              timestamp: new Date(),
              amount: amount,
              paymentMethod,
              cardBrand,
              last4,
            };
          } catch (e) {
            const error = e as Error;
            logger.error('Payment processing error:', error);

            // Update UI state
            setState(prev => ({
              ...prev,
              isProcessingPayment: false,
              lastError: error.message,
            }));

            // Try to determine if this is a connection error
            const isConnectionError =
              error.message?.toLowerCase().includes('connect') ||
              error.message?.toLowerCase().includes('network') ||
              error.message?.toLowerCase().includes('timeout');

            return {
              success: false,
              errorMessage: error.message,
              errorCode: isConnectionError ? 'connection_error' : 'payment_error',
              timestamp: new Date(),
            };
          }
        },

        cancelPayment: async transactionId => {
          try {
            if (!terminal || !terminal.cancelPaymentIntent) {
              setState(prev => ({
                ...prev,
                lastError: 'Terminal SDK not available',
              }));
              return false;
            }

            // The Stripe Terminal SDK requires a backend call to first retrieve the payment intent
            // before cancelling, as the terminal itself may not have the full intent details.
            // The backend holds the secret key — it is never sent from the register (PAY-03).
            await cancelStripePayment(transactionId);
            return true;
          } catch (e) {
            const error = e as Error;
            setState(prev => ({ ...prev, lastError: error.message }));
            return false;
          }
        },

        refundPayment: async (transactionId, amount) => {
          // Refunds go through the merchant's backend, which calls the Stripe
          // Refunds API with the secret key it holds (PAY-03).
          try {
            await createStripeRefund(transactionId, amount);

            setState(prev => ({
              ...prev,
              lastError: null,
            }));

            return true;
          } catch (e) {
            const error = e as Error;
            setState(prev => ({ ...prev, lastError: error.message }));
            return false;
          }
        },
      }),
      [terminal]
    );

    // Register with the singleton manager
    useEffect(() => {
      StripeTerminalBridgeManager.getInstance().registerBridge({ state, actions: bridgeActions });
    }, [bridgeActions]);

    return (
      <StripeTerminalBridgeContext.Provider value={{ state, actions: bridgeActions }}>{children}</StripeTerminalBridgeContext.Provider>
    );
  };

  // Wrap everything with the Stripe Terminal Provider
  return (
    <StripeTerminalProvider logLevel="verbose" tokenProvider={fetchTokenProvider}>
      <StripeTerminalBridgeContent />
    </StripeTerminalProvider>
  );
};
