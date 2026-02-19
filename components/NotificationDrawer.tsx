import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { useNotifications } from '../contexts/NotificationProvider';
import { AppNotification, NotificationSeverity } from '../services/notifications/NotificationTypes';

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
  onAction?: (key: string, payload?: string) => void;
}

const SEVERITY_ICON: Record<NotificationSeverity, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
  info: { icon: 'info', color: lightColors.info },
  warning: { icon: 'warning', color: lightColors.warning },
  error: { icon: 'error', color: lightColors.error },
  success: { icon: 'check-circle', color: lightColors.success },
};

const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ visible, onClose, onAction }) => {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } = useNotifications();

  const handlePress = (notif: AppNotification) => {
    markRead(notif.id);
    if (notif.actionKey && onAction) {
      onAction(notif.actionKey, notif.actionPayload);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const sev = SEVERITY_ICON[item.severity];
    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.read && styles.notifUnread]}
        onPress={() => handlePress(item)}
        accessibilityLabel={`${item.severity} notification: ${item.title}. ${item.message}`}
        accessibilityRole="button"
        accessibilityState={{ selected: item.read }}
        accessibilityHint={item.actionLabel ? `Double tap to ${item.actionLabel}` : 'Double tap to mark as read'}
      >
        <MaterialIcons name={sev.icon} size={20} color={sev.color} style={styles.notifIcon} />
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.notifTime}>{formatTimeAgo(item.timestamp)}</Text>
          </View>
          <Text style={styles.notifMessage} numberOfLines={2}>
            {item.message}
          </Text>
          {item.actionLabel && <Text style={styles.notifAction}>{item.actionLabel} →</Text>}
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={markAllRead}
                  style={styles.headerButton}
                  accessibilityLabel="Mark all notifications as read"
                  accessibilityRole="button"
                >
                  <Text style={styles.headerButtonText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              {notifications.length > 0 && (
                <TouchableOpacity
                  onPress={clearAll}
                  style={styles.headerButton}
                  accessibilityLabel="Clear all notifications"
                  accessibilityRole="button"
                >
                  <Text style={[styles.headerButtonText, { color: lightColors.error }]}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close notifications"
                accessibilityRole="button"
              >
                <MaterialIcons name="close" size={20} color={lightColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="notifications-none" size={48} color={lightColors.textSecondary} />
                <Text style={styles.emptyTitle}>No notifications</Text>
                <Text style={styles.emptyDescription}>You'll see sync alerts, low stock warnings, and other updates here.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: lightColors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '70%',
    ...elevation.high,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerButtonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
  },
  closeButton: {
    padding: spacing.xs,
  },
  list: {
    flex: 1,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  notifUnread: {
    backgroundColor: lightColors.primary + '08',
  },
  notifIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textPrimary,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  notifTime: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginLeft: spacing.sm,
  },
  notifMessage: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  notifAction: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lightColors.primary,
    marginLeft: spacing.sm,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginTop: spacing.md,
  },
  emptyDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default NotificationDrawer;
