import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography } from '../utils/theme';
import { useNotifications } from '../contexts/NotificationProvider';
import { useTranslate } from '../hooks/useTranslate';

interface NotificationBellProps {
  onPress: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onPress }) => {
  const { t } = useTranslate();
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.container}
      accessibilityLabel={unreadCount > 0 ? t('notifications.unreadLabel', { count: unreadCount }) : t('notifications.label')}
      accessibilityRole="button"
      accessibilityHint={t('notifications.openHint')}
    >
      <MaterialIcons name="notifications" size={24} color={lightColors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.badge} accessibilityElementsHidden>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xs,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: lightColors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.xs - 2,
    fontWeight: '700',
  },
});

export default NotificationBell;
