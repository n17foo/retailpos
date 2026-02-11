import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';
import { Button } from './Button';

interface FloatingSaveBarProps {
  visible: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saving?: boolean;
  message?: string;
}

export const FloatingSaveBar: React.FC<FloatingSaveBarProps> = ({
  visible,
  onSave,
  onDiscard,
  saving = false,
  message = 'You have unsaved changes',
}) => {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Button title="Discard" variant="ghost" size="sm" onPress={onDiscard} disabled={saving} />
          <Button title="Save Changes" variant="primary" size="sm" onPress={onSave} loading={saving} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: lightColors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...elevation.high,
  },
  message: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textOnPrimary,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});

export default FloatingSaveBar;
