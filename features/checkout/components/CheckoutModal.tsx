import React, { useState, useCallback } from 'react';
import type { PaymentLine as OrderPaymentLine } from '../../orders-sync/services/order/order';
import type { PaymentMode } from '../../payments/hooks/usePayment';
import { PaymentProvider } from '../../payments/services/PaymentServiceFactory';
import { MethodSelectStep } from './MethodSelectStep';
import { CashTenderStep } from './CashTenderStep';
import { SplitTenderStep } from './SplitTenderStep';

export type PaymentMethod = 'cash' | 'card' | 'terminal' | 'store_credit' | 'loyalty';

export interface PaymentSelection {
  method: PaymentMethod;
  /** Only set for cash payments — amount the customer handed over */
  tenderedAmount?: number;
}

interface CheckoutModalProps {
  visible: boolean;
  orderId: string;
  orderTotal: number;
  orderSubtotal: number;
  orderTax: number;
  itemCount: number;
  onSelectPayment: (selection: PaymentSelection) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  terminalConnected?: boolean;
  /**
   * Payment mode derived from the active provider and device type.
   * Drives which payment options are shown.
   */
  paymentMode?: PaymentMode;
  /** The currently active payment provider — used for labelling the terminal option. */
  activeProvider?: PaymentProvider;
  /** Collected payment lines so far (split tender) */
  paymentLines?: OrderPaymentLine[];
  onAddPaymentLine?: (line: Omit<OrderPaymentLine, 'id' | 'processedAt'>) => void;
  onRemovePaymentLine?: (lineId: string) => void;
  onCompleteSplit?: () => void;
  splitMode?: boolean;
  /** Amount for cash tender in split mode (null = not in cash tender) */
  splitCashTenderAmount?: number | null;
  onConfirmSplitCash?: (tenderedAmount: number) => void;
  /** Customer email for loyalty/store credit */
  customerEmail?: string;
  /** Available loyalty points */
  loyaltyPoints?: number;
  /** Available store credit in dollars */
  storeCreditDollars?: number;
  /**
   * Fast-path tender picked on the tender bar (spec §4.7):
   * 'cash' opens straight into the cash-tender keypad; 'card' pre-selects the
   * terminal method and fires it immediately when a terminal is connected.
   */
  initialTender?: 'cash' | 'card' | null;
  /** Last checkout/payment failure — shown inline so the cashier can retry (§4.7) */
  error?: string | null;
}

type ModalStep = 'method' | 'cash_tender' | 'split_tender';

export const CheckoutModal: React.FC<CheckoutModalProps> = props => {
  const {
    visible,
    orderId,
    orderTotal,
    orderSubtotal,
    orderTax,
    itemCount,
    onSelectPayment,
    onCancel,
    isProcessing = false,
    terminalConnected = false,
    paymentMode = 'cash_only',
    activeProvider,
    paymentLines = [],
    onAddPaymentLine,
    onRemovePaymentLine,
    onCompleteSplit,
    splitMode = false,
    splitCashTenderAmount = null,
    onConfirmSplitCash,
    customerEmail,
    loyaltyPoints = 0,
    storeCreditDollars = 0,
    initialTender = null,
    error = null,
  } = props;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [step, setStep] = useState<ModalStep>(splitMode ? 'split_tender' : 'method');
  // Cash tendering — stored as a string so the keypad can build it digit by digit
  const [tenderedStr, setTenderedStr] = useState('');
  // Split tender — amount input for the current line being added
  const [splitAmountStr, setSplitAmountStr] = useState('');
  const [splitMethod, setSplitMethod] = useState<PaymentMethod>('cash');

  // The modal stays mounted between sales: start every checkout from a clean state
  // (otherwise the previous sale's step, method and tendered amount leak into the next one).
  // A tender picked on the tender bar skips the method step entirely (spec §4.7).
  React.useEffect(() => {
    if (!visible) return;
    setTenderedStr('');
    setSplitAmountStr('');
    setSplitMethod('cash');
    if (splitMode) {
      setStep('split_tender');
      setSelectedMethod('cash');
    } else if (initialTender === 'cash') {
      setSelectedMethod('cash');
      setStep('cash_tender');
    } else if (initialTender === 'card') {
      setSelectedMethod(paymentMode === 'tap_to_pay' ? 'terminal' : 'cash');
      setStep('method');
    } else {
      setStep('method');
      setSelectedMethod('cash');
    }
  }, [visible, splitMode, initialTender, paymentMode]);

  // Card fast path: a connected terminal fires immediately — no confirmation tap.
  // Without a terminal the method stays pre-selected so the cashier can connect it.
  const autoTenderedRef = React.useRef(false);
  React.useEffect(() => {
    if (!visible) {
      autoTenderedRef.current = false;
      return;
    }
    if (autoTenderedRef.current) return;
    if (initialTender === 'card' && paymentMode === 'tap_to_pay' && activeProvider && terminalConnected) {
      autoTenderedRef.current = true;
      onSelectPayment({ method: 'terminal' });
    }
  }, [visible, initialTender, paymentMode, activeProvider, terminalConnected, onSelectPayment]);

  // When splitCashTenderAmount is set, transition to cash_tender step
  React.useEffect(() => {
    if (splitCashTenderAmount !== null && splitCashTenderAmount > 0) {
      setTenderedStr('');
      setStep('cash_tender');
    }
  }, [splitCashTenderAmount]);

  // Reset to method selection whenever the modal opens
  const handleCancel = useCallback(() => {
    setStep('method');
    setTenderedStr('');
    setSplitAmountStr('');
    onCancel();
  }, [onCancel]);

  // "Pay" button on the method selection step
  const handleMethodConfirm = useCallback(() => {
    if (selectedMethod === 'cash') {
      setTenderedStr('');
      setStep('cash_tender');
    } else {
      onSelectPayment({ method: selectedMethod });
    }
  }, [selectedMethod, onSelectPayment]);

  // Keypad handlers for cash tendering
  const handleKeyPress = useCallback((key: string) => {
    if (key === 'biometric') return;
    setTenderedStr(prev => {
      // Prevent more than two decimal places
      const dotIdx = prev.indexOf('.');
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      // Prevent leading zeros (except "0.")
      if (prev === '0' && key !== '.') return key;
      // Only one decimal point
      if (key === '.' && prev.includes('.')) return prev;
      return prev + key;
    });
  }, []);

  const handleDelete = useCallback(() => {
    setTenderedStr(prev => prev.slice(0, -1));
  }, []);

  // Calculate tender validation for handleCashConfirm callback
  const amountDue = splitCashTenderAmount ?? orderTotal;
  const tenderedAmount = parseFloat(tenderedStr) || 0;
  const isTenderValid = tenderedAmount >= amountDue;

  const handleCashConfirm = useCallback(() => {
    if (!isTenderValid) return;
    // If in split mode with a specific amount, confirm that amount
    if (splitCashTenderAmount !== null && onConfirmSplitCash) {
      onConfirmSplitCash(tenderedAmount);
      setStep('split_tender');
    } else {
      // Regular single-tender cash payment
      onSelectPayment({ method: 'cash', tenderedAmount });
    }
  }, [isTenderValid, tenderedAmount, onSelectPayment, splitCashTenderAmount, onConfirmSplitCash]);

  // Physical keyboard drives the cash keypad on pointer devices (spec §4.7.3):
  // digits and '.' type the amount, Backspace deletes, Enter confirms.
  React.useEffect(() => {
    if (!visible || step !== 'cash_tender' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key) || e.key === '.') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCashConfirm();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, step, handleKeyPress, handleDelete, handleCashConfirm]);

  // ── Split tender step ────────────────────────────────────────────────────
  if (step === 'split_tender') {
    return (
      <SplitTenderStep
        visible={visible}
        orderTotal={orderTotal}
        paymentLines={paymentLines}
        splitAmountStr={splitAmountStr}
        onSplitAmountChange={setSplitAmountStr}
        splitMethod={splitMethod}
        onSplitMethodChange={setSplitMethod}
        paymentMode={paymentMode}
        customerEmail={customerEmail}
        loyaltyPoints={loyaltyPoints}
        storeCreditDollars={storeCreditDollars}
        error={error}
        isProcessing={isProcessing}
        onAddPaymentLine={onAddPaymentLine}
        onRemovePaymentLine={onRemovePaymentLine}
        onCompleteSplit={onCompleteSplit}
        onBack={() => setStep('method')}
        onCancel={handleCancel}
      />
    );
  }

  // ── Cash tendering step ──────────────────────────────────────────────────
  if (step === 'cash_tender') {
    return (
      <CashTenderStep
        visible={visible}
        isSplitTender={splitCashTenderAmount !== null}
        amountDue={splitCashTenderAmount ?? orderTotal}
        tenderedStr={tenderedStr}
        onKeyPress={handleKeyPress}
        onDelete={handleDelete}
        onQuickAmount={value => setTenderedStr(value.toFixed(2))}
        error={error}
        isProcessing={isProcessing}
        onConfirm={handleCashConfirm}
        onBack={() => setStep(splitCashTenderAmount !== null ? 'split_tender' : 'method')}
        onCancel={handleCancel}
      />
    );
  }

  // ── Method selection step ────────────────────────────────────────────────
  return (
    <MethodSelectStep
      visible={visible}
      orderId={orderId}
      orderTotal={orderTotal}
      orderSubtotal={orderSubtotal}
      orderTax={orderTax}
      itemCount={itemCount}
      selectedMethod={selectedMethod}
      onSelectMethod={setSelectedMethod}
      terminalConnected={terminalConnected}
      paymentMode={paymentMode}
      activeProvider={activeProvider}
      customerEmail={customerEmail}
      loyaltyPoints={loyaltyPoints}
      storeCreditDollars={storeCreditDollars}
      error={error}
      isProcessing={isProcessing}
      onConfirm={handleMethodConfirm}
      onSplit={() => setStep('split_tender')}
      onCancel={handleCancel}
    />
  );
};

export default CheckoutModal;
