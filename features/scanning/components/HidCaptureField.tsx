import React, { useEffect, useRef } from 'react';
import { TextInput, StyleSheet, Platform, type TextInputInstance } from 'react-native';
import { HidBurstDetector } from '../utils/hidBurst';
import { scannerSettingsService } from '../../hardware/services/scanner/ScannerSettingsService';

interface HidCaptureFieldProps {
  onScan: (code: string) => void;
}

/** How often the field reclaims focus when no other input owns it */
const REFOCUS_MS = 400;

/**
 * Hidden focused TextInput that captures iOS/Android HID scanner input
 * (spec §4.5.3). On native platforms, HID scanners inject keystrokes into the
 * focused field; keeping an invisible input focused routes bursts here, where
 * the shared burst detector turns them into scans and swallows them.
 *
 * Focus is only taken when no other TextInput owns it — the omnibar, checkout
 * keypads, and modal inputs always win (TextInput.State tells us exactly which
 * input is focused).
 *
 * On web/Electron the DOM-level keydown listeners in the scanner services do
 * the same job, so this renders nothing.
 */
export const HidCaptureField: React.FC<HidCaptureFieldProps> = ({ onScan }) => {
  const inputRef = useRef<TextInputInstance>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const detectorRef = useRef<HidBurstDetector | null>(null);
  if (!detectorRef.current) {
    detectorRef.current = new HidBurstDetector(scannerSettingsService.getUsbConfig(), code => onScanRef.current(code));
  }

  // Reclaim focus whenever no real input owns it — polls so it recovers after
  // sheets/modals dismiss without fighting their inputs while they are open.
  useEffect(() => {
    const poll = setInterval(() => {
      if (!TextInput.State.currentlyFocusedInput()) {
        inputRef.current?.focus();
      }
    }, REFOCUS_MS);
    return () => clearInterval(poll);
  }, []);

  if (Platform.OS === 'web') return null;

  const config = scannerSettingsService.getUsbConfig();
  const feed = (key: string) => detectorRef.current?.handleKey(key);

  return (
    <TextInput
      ref={inputRef}
      style={styles.hidden}
      autoFocus
      value=""
      autoCorrect={false}
      autoCapitalize="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      showSoftInputOnFocus={false}
      onChangeText={text => {
        // Deliver each character to the burst detector — scanner speed vs typing
        for (const ch of text) {
          feed(ch);
        }
      }}
      onKeyPress={({ nativeEvent }) => {
        if (nativeEvent.key === config.suffixChar) {
          feed(nativeEvent.key);
        }
      }}
      onSubmitEditing={() => feed('Enter')}
    />
  );
};

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -100,
  },
});
