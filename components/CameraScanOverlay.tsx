import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightColors, spacing, borderRadius, typography, elevation, interactionStyle } from '../utils/theme';

interface CameraScanOverlayProps {
  visible: boolean;
  onClose: () => void;
  /** Called for every decoded code — the hook de-duplicates; scanning never locks */
  onScanned: (result: BarcodeScanningResult) => void;
  /** 'full' covers the screen (phone); 'side' leaves the basket visible (tablet/desktop) */
  presentation?: 'full' | 'side';
}

/**
 * Continuous camera scanner overlay (spec §4.5.4).
 * Scanning never pauses after a successful read — per-code de-dup in
 * useSaleScanner absorbs repeats of the same frame.
 */
export const CameraScanOverlay: React.FC<CameraScanOverlayProps> = ({ visible, onClose, onScanned, presentation = 'full' }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();

  const frame = (
    <View style={[styles.cameraBox, presentation === 'side' && styles.cameraBoxSide]}>
      {!permission ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={lightColors.primary} />
        </View>
      ) : !permission.granted ? (
        <View style={styles.centered}>
          <MaterialIcons name="photo-camera" size={48} color={lightColors.textSecondary} />
          <Text style={styles.permissionTitle}>Camera permission needed</Text>
          <Pressable
            style={state => [styles.permissionButton, interactionStyle(state)]}
            onPress={requestPermission}
            accessibilityRole="button"
          >
            <Text style={styles.permissionButtonText}>Allow camera</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'upc_e', 'upc_a', 'qr', 'aztec', 'datamatrix', 'pdf417'],
            }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.aim} pointerEvents="none">
            <View style={styles.aimBox} />
          </View>
        </>
      )}

      <Pressable
        style={state => [styles.closeButton, { top: insets.top + spacing.sm }, interactionStyle(state)]}
        onPress={onClose}
        accessibilityLabel="Close camera scanner"
        accessibilityRole="button"
      >
        <MaterialIcons name="close" size={24} color={lightColors.textOnPrimary} />
      </Pressable>
    </View>
  );

  if (presentation === 'side') {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
        <View style={styles.sideOverlay}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close scanner" accessibilityRole="button" />
          {frame}
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {frame}
    </Modal>
  );
};

const styles = StyleSheet.create({
  cameraBox: { flex: 1, backgroundColor: '#000' },
  cameraBoxSide: { width: 400, maxWidth: '55%', ...elevation.high },
  sideOverlay: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: lightColors.overlay },
  backdrop: { ...StyleSheet.absoluteFill },
  camera: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: lightColors.surface },
  permissionTitle: { fontSize: typography.fontSize.lg, fontWeight: '600', color: lightColors.textPrimary, marginTop: spacing.md },
  permissionButton: {
    marginTop: spacing.lg,
    backgroundColor: lightColors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  permissionButtonText: { color: lightColors.textOnPrimary, fontWeight: '600', fontSize: typography.fontSize.md },
  aim: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center' },
  aimBox: { width: 240, height: 160, borderWidth: 2, borderColor: lightColors.primary, borderRadius: borderRadius.md },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
