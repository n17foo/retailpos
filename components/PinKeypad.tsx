import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { lightColors, borderRadius, spacing, typography } from '../utils/theme';

interface PinKeypadProps {
  onKeyPress: (key: string) => void;
  onDeletePress: () => void;
  disableBiometric?: boolean;
}

/**
 * A numeric keypad component for PIN entry
 * Similar to iPhone lock screen keypad
 */
const PinKeypad: React.FC<PinKeypadProps> = ({ onKeyPress, onDeletePress, disableBiometric = false }) => {
  const renderKey = (key: string | React.ReactNode, value?: string) => {
    return (
      <TouchableOpacity style={styles.keyContainer} onPress={() => onKeyPress(value || (typeof key === 'string' ? key : ''))}>
        {typeof key === 'string' ? <Text style={styles.keyText}>{key}</Text> : key}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {renderKey('1')}
        {renderKey('2')}
        {renderKey('3')}
      </View>
      <View style={styles.row}>
        {renderKey('4')}
        {renderKey('5')}
        {renderKey('6')}
      </View>
      <View style={styles.row}>
        {renderKey('7')}
        {renderKey('8')}
        {renderKey('9')}
      </View>
      <View style={styles.row}>
        {!disableBiometric ? (
          <TouchableOpacity style={styles.keyContainer} onPress={() => onKeyPress('biometric')}>
            <Text style={styles.biometricIcon}>👆</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.keyContainer} />
        )}
        {renderKey('0')}
        <TouchableOpacity style={styles.keyContainer} onPress={onDeletePress}>
          <Text style={styles.deleteIcon}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 280,
    marginHorizontal: 'auto',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  keyContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.keypadButton,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '500', // Using literal value as React Native expects specific string literal type
    color: lightColors.textPrimary,
  },
  deleteIcon: {
    fontSize: typography.fontSize.xl,
    color: lightColors.textSecondary,
  },
  biometricIcon: {
    fontSize: typography.fontSize.xl,
  },
});

export default PinKeypad;
