import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, Animated, TouchableOpacity } from 'react-native';
import { lightColors, spacing, typography, borderRadius } from '../utils/theme';
import PinKeypad from '../components/PinKeypad';
import PinDisplay from '../components/PinDisplay';
import { userRepository, User } from '../repositories/UserRepository';

interface LoginScreenProps {
  onLogin: (pin: string, user?: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [pin, setPin] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake] = useState(new Animated.Value(0));

  // Configure pin entry
  const PIN_LENGTH = 6;

  // Handle shake animation for invalid PIN
  const startShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Handle pin entry
  const handleKeyPress = (key: string) => {
    // Handle special keys
    if (key === 'biometric') {
      // Biometric authentication could be added here
      return;
    }

    // Don't allow more digits than PIN_LENGTH
    if (pin.length >= PIN_LENGTH) return;

    // Add digit to PIN
    const newPin = pin + key;
    setPin(newPin);

    // If PIN is complete, attempt login
    if (newPin.length === PIN_LENGTH) {
      handleLogin(newPin);
    }
  };

  // Handle delete/backspace
  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  // Attempt login with entered PIN
  const handleLogin = async (pinToCheck: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if there are any users in the system
      const hasUsers = await userRepository.hasAdminUser();

      if (!hasUsers) {
        // No users exist - allow any PIN for initial setup/development
        setIsLoading(false);
        if (onLogin) {
          onLogin(pinToCheck);
          console.log('No users in system - allowing login for setup');
        }
        return;
      }

      // Validate PIN against stored users
      const user = await userRepository.findByPin(pinToCheck);

      setIsLoading(false);

      if (user) {
        // Valid user found
        if (onLogin) {
          onLogin(pinToCheck, user);
          console.log('Login successful for user:', user.name);
        }
      } else {
        // Invalid PIN
        setError('Invalid PIN. Please try again.');
        startShake();
        setPin('');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Login failed. Please try again.');
      startShake();
      setPin('');
      console.error('Login error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>RetailPOS</Text>
        <Text style={styles.tagline}>Point of Sale System</Text>
      </View>

      <Animated.View style={[styles.pinContainer, { transform: [{ translateX: shake }] }]}>
        <Text style={styles.pinTitle}>Enter PIN</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <PinDisplay pinLength={PIN_LENGTH} filledCount={pin.length} />

        <PinKeypad onKeyPress={handleKeyPress} onDeletePress={handleDelete} />

        {isLoading && <Text style={styles.loadingText}>Logging in...</Text>}
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 RetailPOS Inc.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: spacing.xxl * 1.6,
  },
  logoText: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: '700', // Using literal value as React Native expects specific string literals
    color: lightColors.primary,
  },
  tagline: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.sm,
  },
  pinContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  pinTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600', // Using literal value as React Native expects specific string literals
    color: lightColors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.fontSize.md,
    color: lightColors.error,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.md,
    color: lightColors.primary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  footerText: {
    color: lightColors.textHint,
  },
});

export default LoginScreen;
