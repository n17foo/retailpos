import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import NotificationBell from './NotificationBell';

jest.mock('../hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../contexts/NotificationProvider', () => ({
  useNotifications: () => ({ unreadCount: 5 }),
}));

describe('NotificationBell', () => {
  it('renders unread count badge and handles onPress', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(<NotificationBell onPress={onPress} />);
    expect(hasText(tree, '5')).toBe(true);
    await pressByText(tree, '5');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
