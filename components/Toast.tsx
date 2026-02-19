import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { AppNotification, NotificationSeverity } from '../services/notifications/NotificationTypes';

interface ToastProps {
  notification: AppNotification | null;
  onDismiss: () => void;
}

const SEVERITY_CONFIG: Record<NotificationSeverity, { color: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  info: { color: lightColors.info, icon: 'info' },
  warning: { color: lightColors.warning, icon: 'warning' },
  error: { color: lightColors.error, icon: 'error' },
  success: { color: lightColors.success, icon: 'check-circle' },
};

const Toast: React.FC<ToastProps> = ({ notification, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (notification) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [notification, translateY]);

  if (!notification) return null;

  const config = SEVERITY_CONFIG[notification.severity];

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <View style={[styles.toast, { borderLeftColor: config.color }]}>
        <MaterialIcons name={config.icon} size={20} color={config.color} style={styles.icon} />
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
          <MaterialIcons name="close" size={18} color={lightColors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    ...elevation.high,
  },
  icon: {
    marginRight: spacing.sm,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  dismissButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});

export default Toast;
