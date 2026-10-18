import React from 'react';
import Input from '../../../shared/components/Input';

interface AmountRefundFormProps {
  idLabel: string;
  idPlaceholder: string;
  idValue: string;
  amount: string;
  reason: string;
  onIdChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onReasonChange: (value: string) => void;
}

/**
 * ID + amount + reason form used by the payment-refund and e-commerce-refund
 * variants (identical fields, different ID label).
 */
export const AmountRefundForm: React.FC<AmountRefundFormProps> = ({
  idLabel,
  idPlaceholder,
  idValue,
  amount,
  reason,
  onIdChange,
  onAmountChange,
  onReasonChange,
}) => (
  <>
    <Input label={idLabel} placeholder={idPlaceholder} value={idValue} onChangeText={onIdChange} required />
    <Input
      label="Amount"
      placeholder="Enter refund amount"
      value={amount}
      onChangeText={onAmountChange}
      keyboardType="decimal-pad"
      required
    />
    <Input
      label="Reason"
      placeholder="Reason for refund (optional)"
      value={reason}
      onChangeText={onReasonChange}
      multiline
      numberOfLines={3}
    />
  </>
);
