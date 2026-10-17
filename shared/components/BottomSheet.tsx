import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightColors, spacing, typography, borderRadius, elevation, interactionStyle } from '../utils/theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Fraction of screen height the sheet occupies (default 0.85) */
  heightFraction?: number;
}

/**
 * Shared bottom sheet used by the basket and the main menu on the stacked
 * (phone) shell. Safe-area aware.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, title, children, heightFraction = 0.85 }) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          style={[styles.sheet, { height: `${Math.round(heightFraction * 100)}%`, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={styles.grabber} />
            {title !== undefined && <Text style={styles.title}>{title}</Text>}
            <Pressable
              style={state => [styles.closeButton, interactionStyle(state)]}
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={22} color={lightColors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: lightColors.overlay },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: lightColors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    ...elevation.high,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: lightColors.border, marginBottom: spacing.xs },
  title: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary, paddingBottom: spacing.xs },
  closeButton: { position: 'absolute', right: spacing.md, top: spacing.sm },
  body: { flex: 1 },
});
