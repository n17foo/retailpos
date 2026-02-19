export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: Date;
  read: boolean;
  /** Optional action label (e.g. "View Order", "Retry") */
  actionLabel?: string;
  /** Optional callback key — the UI maps this to an actual handler */
  actionKey?: string;
  /** Optional payload for the action (e.g. orderId) */
  actionPayload?: string;
}
