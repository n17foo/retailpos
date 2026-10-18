import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { CashTenderStep } from './CashTenderStep';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string, params?: Record<string, string>) => (params ? `${k}:${Object.values(params).join(',')}` : k) }),
}));

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

jest.mock('../../authentication/components/PinKeypad', () => ({
  __esModule: true,
  default: () => null,
}));

const baseProps = {
  visible: true,
  isSplitTender: false,
  amountDue: 10.76,
  tenderedStr: '',
  onKeyPress: jest.fn(),
  onDelete: jest.fn(),
  onQuickAmount: jest.fn(),
  error: null,
  isProcessing: false,
  onConfirm: jest.fn(),
  onBack: jest.fn(),
  onCancel: jest.fn(),
};

describe('CashTenderStep', () => {
  it('renders amount due and a zero tendered placeholder', async () => {
    const tree = await renderUi(<CashTenderStep {...baseProps} />);
    expect(hasText(tree, '£10.76')).toBe(true);
    expect(hasText(tree, '£0.00')).toBe(true);
    expect(hasText(tree, 'checkout.amountShort')).toBe(true);
  });

  it('shows change due and enables the confirm title when tender covers the total', async () => {
    const tree = await renderUi(<CashTenderStep {...baseProps} tenderedStr="20" />);
    expect(hasText(tree, 'checkout.changeDue')).toBe(true);
    expect(hasText(tree, '£9.24')).toBe(true);
    expect(hasText(tree, 'checkout.confirmCash:£9.24')).toBe(true);
  });

  it('fires onQuickAmount when a quick-tender chip is pressed', async () => {
    const onQuickAmount = jest.fn();
    const tree = await renderUi(<CashTenderStep {...baseProps} onQuickAmount={onQuickAmount} />);
    await pressByText(tree, 'checkout.exact');
    expect(onQuickAmount).toHaveBeenCalledWith(10.76);
  });

  it('labels the header and confirm button for split tenders', async () => {
    const tree = await renderUi(<CashTenderStep {...baseProps} isSplitTender amountDue={5} tenderedStr="5" />);
    expect(hasText(tree, 'Cash Payment (Split)')).toBe(true);
    expect(hasText(tree, 'Add Cash Payment (Change: £0.00)')).toBe(true);
  });
});
