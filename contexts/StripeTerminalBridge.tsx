/**
 * StripeTerminalBridge — platform-safe shell.
 *
 * The real provider lives in `StripeTerminalBridgeImpl.tsx`, which has a
 * top-level dependency on `@stripe/stripe-terminal-react-native`. That native
 * module does not exist in Expo Go or on web/Electron, so it is loaded via a
 * conditional `require()` only on real iOS/Android builds. Everywhere else the
 * provider renders children directly and the bridge manager simply stays
 * unregistered (callers handle the missing bridge gracefully).
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { LoggerFactory } from '../services/logger/LoggerFactory';

// Define types based on Stripe Terminal SDK (incomplete type definitions)
export interface Reader {
  serialNumber: string;
  deviceType?: string;
  status?: string;
  label?: string;
  [key: string]: unknown;
}
export type CommonError = { message?: string; code?: string };

// Types for our bridge
export interface StripeTerminalBridgeState {
  initialized: boolean;
  isConnecting: boolean;
  isProcessingPayment: boolean;
  connectedReader: Reader | null;
  discoveredReaders: Reader[];
  lastError: string | null;
}

export interface StripeTerminalBridgeActions {
  initialize: () => Promise<boolean>;
  discoverReaders: (options: { discoveryMethod: string; simulated?: boolean }) => Promise<Reader[]>;
  connectToReader: (readerId: string) => Promise<boolean>;
  disconnectReader: () => Promise<boolean>;
  processPayment: (options: { amount: number; currency: string; description: string; metadata?: Record<string, string> }) => Promise<{
    success: boolean;
    transactionId?: string;
    receiptNumber?: string;
    errorMessage?: string;
    errorCode?: string;
    timestamp?: Date;
    amount?: number;
    paymentMethod?: string;
    cardBrand?: string;
    last4?: string;
  }>;
  cancelPayment: (transactionId: string) => Promise<boolean>;
  refundPayment: (transactionId: string, amount: number) => Promise<boolean>;
}

// Create the context
export const StripeTerminalBridgeContext = createContext<{
  state: StripeTerminalBridgeState;
  actions: StripeTerminalBridgeActions;
} | null>(null);

const logger = LoggerFactory.getInstance().createLogger('StripeTerminalBridge');

type ImplComponent = React.ComponentType<{ children: ReactNode }>;
let implCache: ImplComponent | null | undefined;

/**
 * Loads the real provider implementation, or null when the Stripe Terminal
 * SDK cannot run here:
 *   - Expo Go (Constants.appOwnership === 'expo') — no native modules
 *   - web / Electron (Platform.OS === 'web') — card path is cash-only anyway
 *   - dev builds where the module failed to link — require() throws, we catch
 */
function loadBridgeImpl(): ImplComponent | null {
  if (implCache !== undefined) {
    return implCache ?? null;
  }
  implCache = null;
  const isExpoGo = Constants.appOwnership === 'expo';
  const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
  if (!isNative || isExpoGo) {
    return implCache;
  }
  try {
    const impl: ImplComponent | null = require('./StripeTerminalBridgeImpl').StripeTerminalBridgeProvider;
    implCache = impl;
  } catch (error) {
    logger.warn(
      { message: 'Stripe Terminal SDK unavailable — bridge disabled' },
      error instanceof Error ? error : new Error(String(error))
    );
  }
  return implCache ?? null;
}

/**
 * Renders the real Stripe-backed bridge on supported builds; passes children
 * through untouched everywhere else.
 */
export const StripeTerminalBridgeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const Impl = loadBridgeImpl();
  if (!Impl) {
    return <>{children}</>;
  }
  return <Impl>{children}</Impl>;
};

// Export the hook to use the bridge
export const useStripeTerminalBridge = () => {
  const context = useContext(StripeTerminalBridgeContext);
  if (!context) {
    throw new Error('useStripeTerminalBridge must be used within a StripeTerminalBridgeProvider');
  }
  return context;
};

// Singleton to access the bridge from non-React contexts
export class StripeTerminalBridgeManager {
  private static instance: StripeTerminalBridgeManager;
  private bridgeRef: {
    state: StripeTerminalBridgeState;
    actions: StripeTerminalBridgeActions;
  } | null = null;

  private constructor() {}

  public static getInstance(): StripeTerminalBridgeManager {
    if (!StripeTerminalBridgeManager.instance) {
      StripeTerminalBridgeManager.instance = new StripeTerminalBridgeManager();
    }
    return StripeTerminalBridgeManager.instance;
  }

  public registerBridge(bridge: { state: StripeTerminalBridgeState; actions: StripeTerminalBridgeActions }) {
    this.bridgeRef = bridge;
  }

  public get bridge() {
    return this.bridgeRef;
  }

  // Convenience methods that can be called from non-React contexts
  public async discoverReaders(options: { discoveryMethod: string; simulated?: boolean }) {
    if (!this.bridgeRef) {
      throw new Error('Stripe Terminal Bridge is not registered');
    }
    return this.bridgeRef.actions.discoverReaders(options);
  }

  public async connectToReader(readerId: string) {
    if (!this.bridgeRef) {
      throw new Error('Stripe Terminal Bridge is not registered');
    }
    return this.bridgeRef.actions.connectToReader(readerId);
  }

  public async processPayment(options: {
    amount: number;
    currency: string;
    description: string;
    metadata?: Record<string, string>;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    receiptNumber?: string;
    errorMessage?: string;
    errorCode?: string;
    timestamp: Date; // Make timestamp required to match PaymentResponse
    amount?: number;
    paymentMethod?: string;
    cardBrand?: string;
    last4?: string;
  }> {
    if (!this.bridgeRef) {
      throw new Error('Stripe Terminal Bridge is not registered');
    }
    // Ensure we always return a timestamp even if the bridge doesn't
    const result = await this.bridgeRef.actions.processPayment(options);
    return {
      ...result,
      timestamp: result.timestamp || new Date(), // Ensure timestamp is always present
    };
  }

  public isTerminalInitialized() {
    return this.bridgeRef?.state.initialized || false;
  }

  public getConnectedReader() {
    return this.bridgeRef?.state.connectedReader || null;
  }

  public isReaderConnected() {
    return !!this.bridgeRef?.state.connectedReader;
  }

  public disconnectReader() {
    if (!this.bridgeRef) {
      throw new Error('Stripe Terminal Bridge is not registered');
    }
    return this.bridgeRef.actions.disconnectReader();
  }
}
