import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, spacing, typography, borderRadius } from '../utils/theme';
import PinKeypad from '../components/PinKeypad';
import PinDisplay from '../components/PinDisplay';
import { User } from '../repositories/UserRepository';
import { authService } from '../services/auth/AuthService';
import { authConfig } from '../services/auth/AuthConfigService';
import { AuthMethodProvider, AuthMethodType } from '../services/auth/AuthMethodInterface';

interface LoginScreenProps {
  onLogin: (credential: string, user?: User) => void;
}

const PIN_LENGTH = 6;

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [activeMethod, setActiveMethod] = useState<AuthMethodType>(authConfig.primaryMethod);
  const [availableMethods, setAvailableMethods] = useState<AuthMethodProvider[]>([]);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake] = useState(new Animated.Value(0));
  const [waitingForSwipe, setWaitingForSwipe] = useState(false);

  // Load available auth methods on mount
  useEffect(() => {
    authService.getAvailableProviders().then(providers => {
      setAvailableMethods(providers);
    });
  }, []);

  const startShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  const handleAuthResult = useCallback(
    (credential: string, result: { success: boolean; user?: User; error?: string }) => {
      setIsLoading(false);
      if (result.success) {
        onLogin(credential, result.user);
      } else {
        setError(result.error ?? 'Authentication failed.');
        startShake();
      }
    },
    [onLogin, startShake]
  );

  // ── PIN handlers ────────────────────────────────────────────────────

  const handlePinKeyPress = useCallback(
    (key: string) => {
      if (key === 'biometric') {
        handleBiometricAuth();
        return;
      }
      if (pin.length >= PIN_LENGTH) return;

      const newPin = pin + key;
      setPin(newPin);

      if (newPin.length === PIN_LENGTH) {
        setIsLoading(true);
        setError(null);
        authService.authenticate('pin', newPin).then(result => {
          handleAuthResult(newPin, result);
          if (!result.success) setPin('');
        });
      }
    },
    [pin, handleAuthResult]
  );

  const handlePinDelete = useCallback(() => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  }, [pin]);

  // ── Biometric handler ───────────────────────────────────────────────

  const handleBiometricAuth = useCallback(() => {
    setIsLoading(true);
    setError(null);
    authService.authenticate('biometric').then(result => {
      handleAuthResult('biometric', result);
    });
  }, [handleAuthResult]);

  // ── Password handler ────────────────────────────────────────────────

  const handlePasswordSubmit = useCallback(() => {
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    setIsLoading(true);
    setError(null);
    authService.authenticate('password', password).then(result => {
      handleAuthResult(password, result);
      if (!result.success) setPassword('');
    });
  }, [password, handleAuthResult]);

  // ── Mag-stripe / RFID handler ───────────────────────────────────────

  const handleCardInput = useCallback(
    (cardData: string) => {
      if (!cardData.trim()) return;
      setIsLoading(true);
      setError(null);
      authService.authenticate(activeMethod, cardData).then(result => {
        handleAuthResult(cardData, result);
        setWaitingForSwipe(true);
      });
    },
    [activeMethod, handleAuthResult]
  );

  // ── Platform auth handler ─────────────────────────────────────────

  const handlePlatformAuth = useCallback(() => {
    setIsLoading(true);
    setError(null);
    // Platform auth validates the existing token — no credential needed
    authService.authenticate('platform_auth').then(result => {
      handleAuthResult('platform_auth', result);
    });
  }, [handleAuthResult]);

  // ── Method switcher ─────────────────────────────────────────────────

  const switchMethod = useCallback((method: AuthMethodType) => {
    setActiveMethod(method);
    setPin('');
    setPassword('');
    setError(null);
    setWaitingForSwipe(method === 'magstripe' || method === 'rfid_nfc');
  }, []);

  // ── Render auth method UI ───────────────────────────────────────────

  const renderAuthUI = () => {
    switch (activeMethod) {
      case 'pin':
        return (
          <>
            <Text style={styles.authTitle}>Enter PIN</Text>
            <PinDisplay pinLength={PIN_LENGTH} filledCount={pin.length} />
            <PinKeypad
              onKeyPress={handlePinKeyPress}
              onDeletePress={handlePinDelete}
              disableBiometric={!availableMethods.some(m => m.type === 'biometric')}
            />
          </>
        );

      case 'biometric':
        return (
          <>
            <Text style={styles.authTitle}>Biometric Login</Text>
            <Text style={styles.authDescription}>Use your fingerprint or face to log in.</Text>
            <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
              <Text style={styles.biometricIcon}>👆</Text>
              <Text style={styles.biometricButtonText}>Tap to Authenticate</Text>
            </TouchableOpacity>
          </>
        );

      case 'password':
        return (
          <>
            <Text style={styles.authTitle}>Enter Password</Text>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={lightColors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handlePasswordSubmit}
              returnKeyType="go"
            />
            <TouchableOpacity style={styles.submitButton} onPress={handlePasswordSubmit}>
              <Text style={styles.submitButtonText}>Log In</Text>
            </TouchableOpacity>
          </>
        );

      case 'magstripe':
        return (
          <>
            <Text style={styles.authTitle}>Swipe Employee Card</Text>
            <Text style={styles.authDescription}>Swipe your employee ID card through the card reader.</Text>
            <Text style={styles.waitingIcon}>💳</Text>
            <TextInput style={styles.hiddenInput} autoFocus onChangeText={handleCardInput} value="" blurOnSubmit={false} />
            <Text style={styles.waitingText}>{waitingForSwipe ? 'Waiting for card swipe…' : 'Ready'}</Text>
          </>
        );

      case 'rfid_nfc':
        return (
          <>
            <Text style={styles.authTitle}>Tap Employee Badge</Text>
            <Text style={styles.authDescription}>Hold your badge near the NFC/RFID reader.</Text>
            <Text style={styles.waitingIcon}>📡</Text>
            <TextInput style={styles.hiddenInput} autoFocus onChangeText={handleCardInput} value="" blurOnSubmit={false} />
            <Text style={styles.waitingText}>{waitingForSwipe ? 'Waiting for badge tap…' : 'Ready'}</Text>
          </>
        );

      case 'platform_auth':
        return (
          <>
            <Text style={styles.authTitle}>Platform Login</Text>
            <Text style={styles.authDescription}>Authenticate using your e-commerce platform credentials.</Text>
            <TouchableOpacity style={styles.submitButton} onPress={handlePlatformAuth}>
              <Text style={styles.submitButtonText}>Log In via Platform</Text>
            </TouchableOpacity>
          </>
        );

      default:
        return null;
    }
  };

  const showMethodSwitcher = availableMethods.length > 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>RetailPOS</Text>
        <Text style={styles.tagline}>Point of Sale System</Text>
      </View>

      <Animated.View style={[styles.authContainer, { transform: [{ translateX: shake }] }]}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        {renderAuthUI()}
        {isLoading && <Text style={styles.loadingText}>Logging in...</Text>}
      </Animated.View>

      {/* Method switcher */}
      {showMethodSwitcher && (
        <View style={styles.methodSwitcher}>
          <Text style={styles.switcherLabel}>Log in with:</Text>
          <View style={styles.switcherRow}>
            {availableMethods.map(provider => (
              <TouchableOpacity
                key={provider.type}
                style={[styles.switcherButton, activeMethod === provider.type && styles.switcherButtonActive]}
                onPress={() => switchMethod(provider.type)}
              >
                <Text style={styles.switcherIcon}>{provider.info.icon}</Text>
                <Text style={[styles.switcherText, activeMethod === provider.type && styles.switcherTextActive]}>
                  {provider.info.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
    fontWeight: '700',
    color: lightColors.primary,
  },
  tagline: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.sm,
  },
  authContainer: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  authTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  authDescription: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
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
  // ── Password ──────────────────────────────────────────────────────
  passwordInput: {
    width: '80%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.fontSize.lg,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  submitButton: {
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl * 2,
    borderRadius: borderRadius.md,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
  // ── Biometric ─────────────────────────────────────────────────────
  biometricButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.surface,
    borderWidth: 2,
    borderColor: lightColors.primary,
    marginBottom: spacing.md,
  },
  biometricIcon: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  biometricButtonText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.primary,
    fontWeight: '600',
  },
  // ── Card / Badge ──────────────────────────────────────────────────
  waitingIcon: {
    fontSize: 60,
    marginBottom: spacing.md,
  },
  waitingText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.sm,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  // ── Method switcher ───────────────────────────────────────────────
  methodSwitcher: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  switcherLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  switcherRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  switcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  switcherButtonActive: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '15',
  },
  switcherIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  switcherText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  switcherTextActive: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  footerText: {
    color: lightColors.textHint,
  },
});

export default LoginScreen;
