import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { loginScreenStyles as styles } from './loginScreenStyles';

interface BiometricAuthFormProps {
  onAuthenticate: () => void;
}

/** Biometric login — tap-to-authenticate fingerprint button. */
export const BiometricAuthForm: React.FC<BiometricAuthFormProps> = ({ onAuthenticate }) => {
  const { t } = useTranslate();
  return (
    <>
      <Text style={styles.authTitle}>{t('login.biometricLogin')}</Text>
      <Text style={styles.authDescription}>{t('login.biometricDescription')}</Text>
      <TouchableOpacity
        style={styles.biometricButton}
        onPress={onAuthenticate}
        accessibilityLabel={t('login.tapToAuthenticate')}
        accessibilityRole="button"
      >
        <MaterialIcons name="fingerprint" size={52} color={lightColors.primary} />
        <Text style={styles.biometricButtonText}>{t('login.tapToAuthenticate')}</Text>
      </TouchableOpacity>
    </>
  );
};
