import { AppNotification, NotificationSeverity } from './NotificationTypes';

type NotificationListener = (notification: AppNotification) => void;

const MAX_NOTIFICATIONS = 100;

/**
 * Singleton notification service.
 * Stores recent notifications in memory and emits events to listeners.
 * Integration points (sync failures, low stock, etc.) call `notify()`.
 * The NotificationProvider subscribes via `addListener()`.
 */
export class NotificationService {
  private static instance: NotificationService;
  private notifications: AppNotification[] = [];
  private listeners: Set<NotificationListener> = new Set();

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /** Push a new notification */
  notify(
    title: string,
    message: string,
    severity: NotificationSeverity,
    action?: { label: string; key: string; payload?: string }
  ): AppNotification {
    const notification: AppNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      severity,
      timestamp: new Date(),
      read: false,
      actionLabel: action?.label,
      actionKey: action?.key,
      actionPayload: action?.payload,
    };

    this.notifications.unshift(notification);

    // Cap the list
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(0, MAX_NOTIFICATIONS);
    }

    // Emit to all listeners
    for (const listener of this.listeners) {
      try {
        listener(notification);
      } catch {
        // Don't let a bad listener break the service
      }
    }

    return notification;
  }

  /** Get all notifications (newest first) */
  getAll(): AppNotification[] {
    return [...this.notifications];
  }

  /** Get unread count */
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  /** Mark a single notification as read */
  markRead(id: string): void {
    const notif = this.notifications.find(n => n.id === id);
    if (notif) notif.read = true;
  }

  /** Mark all as read */
  markAllRead(): void {
    for (const n of this.notifications) {
      n.read = true;
    }
  }

  /** Clear all notifications */
  clearAll(): void {
    this.notifications = [];
  }

  /** Subscribe to new notifications */
  addListener(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const notificationService = NotificationService.getInstance();
