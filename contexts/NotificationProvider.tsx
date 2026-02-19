import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppNotification } from '../services/notifications/NotificationTypes';
import { notificationService } from '../services/notifications/NotificationService';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  /** The most recent notification (for toast display) */
  latestToast: AppNotification | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  latestToast: null,
  markRead: () => {},
  markAllRead: () => {},
  clearAll: () => {},
  dismissToast: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestToast, setLatestToast] = useState<AppNotification | null>(null);

  // Subscribe to new notifications
  useEffect(() => {
    // Load existing
    setNotifications(notificationService.getAll());
    setUnreadCount(notificationService.getUnreadCount());

    const unsubscribe = notificationService.addListener(notification => {
      setNotifications(notificationService.getAll());
      setUnreadCount(notificationService.getUnreadCount());
      // Show toast for the new notification
      setLatestToast(notification);
    });

    return unsubscribe;
  }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!latestToast) return;
    const timer = setTimeout(() => setLatestToast(null), 4000);
    return () => clearTimeout(timer);
  }, [latestToast]);

  const markRead = useCallback((id: string) => {
    notificationService.markRead(id);
    setNotifications(notificationService.getAll());
    setUnreadCount(notificationService.getUnreadCount());
  }, []);

  const markAllRead = useCallback(() => {
    notificationService.markAllRead();
    setNotifications(notificationService.getAll());
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    notificationService.clearAll();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback(() => {
    setLatestToast(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, latestToast, markRead, markAllRead, clearAll, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
};
