import React, { useState, useCallback, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  value?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
  debounceMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search products...',
  onSearch,
  onClear,
  value: controlledValue,
  autoFocus = false,
  style,
  debounceMs = 300,
}) => {
  const [internalValue, setInternalValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = useCallback(
    (text: string) => {
      setInternalValue(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(text);
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onSearch('');
    onClear?.();
    inputRef.current?.focus();
  }, [onSearch, onClear]);

  /** Allow parent to focus this input programmatically */
  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={lightColors.textHint}
        value={value}
        onChangeText={handleChange}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Text style={styles.clearText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderWidth: 1,
    borderColor: lightColors.border,
    ...elevation.low,
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    paddingVertical: 0,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  clearText: {
    fontSize: 14,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
});

export default SearchBar;
