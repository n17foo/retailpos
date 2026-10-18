import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { OrderHistoryHeader } from './OrderHistoryHeader';

const baseProps = {
  orderCount: 3,
  unsyncedOrdersCount: 0,
  shiftOpen: false,
  isCashier: false,
  isToday: true,
  dateLabel: 'Today',
  onPreviousDay: jest.fn(),
  onNextDay: jest.fn(),
  onOpenShift: jest.fn(),
  onCloseShift: jest.fn(),
  onViewReport: jest.fn(),
};

describe('OrderHistoryHeader', () => {
  it('renders order count and shift/report actions', async () => {
    const tree = await renderUi(<OrderHistoryHeader {...baseProps} />);
    expect(hasText(tree, 'Order History')).toBe(true);
    expect(hasText(tree, '3 orders')).toBe(true);
    expect(hasText(tree, 'Open Shift')).toBe(true);
    expect(hasText(tree, 'View Report')).toBe(true);
  });

  it('shows pending-sync count and open-shift badge', async () => {
    const tree = await renderUi(<OrderHistoryHeader {...baseProps} unsyncedOrdersCount={2} shiftOpen />);
    expect(hasText(tree, '2 pending sync')).toBe(true);
    expect(hasText(tree, 'Shift Open')).toBe(true);
    expect(hasText(tree, 'Close Shift')).toBe(true);
  });

  it('hides date navigation for cashiers', async () => {
    const tree = await renderUi(<OrderHistoryHeader {...baseProps} isCashier />);
    expect(hasText(tree, 'Today')).toBe(false);
  });

  it('fires shift and report callbacks', async () => {
    const onOpenShift = jest.fn();
    const onViewReport = jest.fn();
    const tree = await renderUi(<OrderHistoryHeader {...baseProps} onOpenShift={onOpenShift} onViewReport={onViewReport} />);
    await pressByText(tree, 'Open Shift');
    expect(onOpenShift).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'View Report');
    expect(onViewReport).toHaveBeenCalledTimes(1);
  });
});
