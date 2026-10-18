import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { AuthMethodProvider, AuthMethodType } from '../services/auth/AuthMethodInterface';
import { loginScreenStyles as styles } from './loginScreenStyles';

interface AuthMethodSwitcherProps {
  providers: AuthMethodProvider[];
  activeMethod: AuthMethodType;
  onSwitch: (method: AuthMethodType) => void;
}

/** Row of sign-in method chips shown when more than one provider is available. */
export const AuthMethodSwitcher: React.FC<AuthMethodSwitcherProps> = ({ providers, activeMethod, onSwitch }) => {
  const { t } = useTranslate();
  if (providers.length <= 1) return null;
  return (
    <View style={styles.methodSwitcher}>
      <Text style={styles.switcherLabel}>{t('login.logInWith')}</Text>
      <View style={styles.switcherRow}>
        {providers.map(provider => (
          <TouchableOpacity
            key={provider.type}
            style={[styles.switcherButton, activeMethod === provider.type && styles.switcherButtonActive]}
            onPress={() => onSwitch(provider.type)}
            accessibilityLabel={`Sign in with ${provider.info.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activeMethod === provider.type }}
          >
            <Text style={styles.switcherIcon}>{provider.info.icon}</Text>
            <Text style={[styles.switcherText, activeMethod === provider.type && styles.switcherTextActive]}>{provider.info.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
