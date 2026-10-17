import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, interactionStyle } from '../../../shared/utils/theme';

export interface OmnibarHandle {
  focus: () => void;
  blur: () => void;
}

interface OmnibarProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Enter pressed — single/exact match is added to the basket by the caller */
  onSubmit: () => void;
  /** Camera scan button — hidden when camera scanning isn't supported (Electron) */
  onCameraPress?: () => void;
  showCamera?: boolean;
  isSearching?: boolean;
  /** Tells the hidden HID capture field whether a text input currently owns focus */
  onFocusChange?: (focused: boolean) => void;
  inputMode?: 'touch' | 'pointer';
  /** phone-landscape: collapse to 🔍 + ▢ buttons; 🔍 expands into the full field */
  collapsed?: boolean;
}

/**
 * The sale-screen omnibar — one field for typed search, SKU/barcode entry and
 * scanner focus. Cmd/Ctrl+K or `/` focuses it (pointer mode).
 */
export const Omnibar = forwardRef<OmnibarHandle, OmnibarProps>(function Omnibar(
  {
    value,
    onChangeText,
    onSubmit,
    onCameraPress,
    showCamera = false,
    isSearching = false,
    onFocusChange,
    inputMode = 'touch',
    collapsed = false,
  },
  ref
) {
  const inputRef = useRef<TextInput>(null);
  const [expanded, setExpanded] = useState(!collapsed);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (collapsed && !expanded) {
        setExpanded(true);
        // Focus after the input mounts
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        inputRef.current?.focus();
      }
    },
    blur: () => inputRef.current?.blur(),
  }));

  // Pointer mode: ⌘/Ctrl+K and / focus the omnibar
  useEffect(() => {
    if (inputMode !== 'pointer' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typingInField = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && !typingInField) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputMode]);

  // Collapsed (phone-landscape): just 🔍 + ▢ buttons until the cashier taps 🔍
  if (collapsed && !expanded) {
    return (
      <View style={[styles.container, styles.containerCollapsed]}>
        <Pressable
          style={state => [styles.iconButton, interactionStyle(state)]}
          onPress={() => {
            setExpanded(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          accessibilityLabel="Search products"
          accessibilityRole="button"
        >
          <MaterialIcons name="search" size={20} color={lightColors.textOnPrimary} />
        </Pressable>
        {showCamera && (
          <Pressable
            style={state => [styles.iconButton, interactionStyle(state)]}
            onPress={onCameraPress}
            accessibilityLabel="Scan with camera"
            accessibilityRole="button"
          >
            <MaterialIcons name="photo-camera" size={20} color={lightColors.textOnPrimary} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MaterialIcons name="search" size={20} color={lightColors.textSecondary} style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Search or scan…"
        placeholderTextColor={lightColors.textHint}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={inputMode === 'pointer'}
        accessibilityLabel="Search products or enter barcode"
        accessibilityRole="search"
      />
      {isSearching && <ActivityIndicator size="small" color={lightColors.primary} style={styles.spinner} />}
      {value.length > 0 && (
        <Pressable
          style={state => [styles.iconButton, interactionStyle(state)]}
          onPress={() => onChangeText('')}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={18} color={lightColors.textSecondary} />
        </Pressable>
      )}
      {showCamera && (
        <Pressable
          style={state => [styles.iconButton, interactionStyle(state)]}
          onPress={onCameraPress}
          accessibilityLabel="Scan with camera"
          accessibilityRole="button"
        >
          <MaterialIcons name="photo-camera" size={20} color={lightColors.primary} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingHorizontal: spacing.sm,
    height: 40,
    flex: 1,
  },
  containerCollapsed: {
    flex: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  searchIcon: { marginRight: spacing.xs },
  input: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    paddingVertical: 0,
  },
  spinner: { marginLeft: spacing.xs },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
