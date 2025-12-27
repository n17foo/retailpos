import React, { useState, forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, TextStyle, TextInputProps, TouchableOpacity } from 'react-native';
import { lightColors, spacing, borderRadius, typography } from '../utils/theme';

export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends TextInputProps {
  /** Label displayed above input */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Helper text displayed below input */
  helperText?: string;
  /** Input size variant */
  size?: InputSize;
  /** Left icon/element */
  leftIcon?: React.ReactNode;
  /** Right icon/element */
  rightIcon?: React.ReactNode;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is required (shows asterisk) */
  required?: boolean;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Custom input style */
  inputStyle?: TextStyle;
  /** Custom label style */
  labelStyle?: TextStyle;
  /** Show clear button when input has value */
  showClearButton?: boolean;
  /** Callback when clear button is pressed */
  onClear?: () => void;
}

/**
 * Reusable Input component with label, error states, and icons
 */
export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      size = 'md',
      leftIcon,
      rightIcon,
      disabled = false,
      required = false,
      containerStyle,
      inputStyle,
      labelStyle,
      showClearButton = false,
      onClear,
      value,
      onChangeText,
      ...rest
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const getInputHeight = (): number => {
      switch (size) {
        case 'sm':
          return 36;
        case 'lg':
          return 52;
        case 'md':
        default:
          return 44;
      }
    };

    const getFontSize = (): number => {
      switch (size) {
        case 'sm':
          return typography.fontSize.sm;
        case 'lg':
          return typography.fontSize.lg;
        case 'md':
        default:
          return typography.fontSize.md;
      }
    };

    const getBorderColor = (): string => {
      if (error) return lightColors.error;
      if (isFocused) return lightColors.primary;
      return lightColors.border;
    };

    const handleClear = () => {
      if (onChangeText) {
        onChangeText('');
      }
      if (onClear) {
        onClear();
      }
    };

    const showClear = showClearButton && value && value.length > 0 && !disabled;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, labelStyle]}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}

        <View
          style={[
            styles.inputContainer,
            {
              height: getInputHeight(),
              borderColor: getBorderColor(),
              backgroundColor: disabled ? lightColors.background : lightColors.surface,
            },
          ]}
        >
          {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              {
                fontSize: getFontSize(),
                color: disabled ? lightColors.textDisabled : lightColors.textPrimary,
              },
              inputStyle,
            ]}
            value={value}
            onChangeText={onChangeText}
            editable={!disabled}
            placeholderTextColor={lightColors.textSecondary}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...rest}
          />

          {showClear && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}

          {rightIcon && !showClear && <View style={styles.iconContainer}>{rightIcon}</View>}
        </View>

        {(error || helperText) && <Text style={[styles.helperText, error && styles.errorText]}>{error || helperText}</Text>}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  required: {
    color: lightColors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  clearText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: spacing.xs,
  },
  errorText: {
    color: lightColors.error,
  },
});

export default Input;
