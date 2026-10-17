import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import NotificationDrawer from './NotificationDrawer';

const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockClearAll = jest.fn();

jest.mock('../hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../contexts/NotificationProvider', () => ({
  useNotifications: () => ({
    unreadCount: 1,
    notifications: [
      {
        id: 'n1',
        title: 'Sync Warning',
        message: '1 order pending',
        severity: 'warning',
        read: false,
        timestamp: new Date(),
        actionKey: 'sync',
        actionLabel: 'Open Sync',
      },
    ],
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
    clearAll: mockClearAll,
  }),
}));

describe('NotificationDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notifications, marks read on press, and triggers markAllRead', async () => {
    const onAction = jest.fn();
    const tree = await renderUi(<NotificationDrawer visible onClose={jest.fn()} onAction={onAction} />);
    expect(hasText(tree, 'Sync Warning')).toBe(true);
    await pressByText(tree, 'Sync Warning');
    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(onAction).toHaveBeenCalledWith('sync', undefined);

    await pressByText(tree, 'notifications.markAllRead');
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
  });
});
