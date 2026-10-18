import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { lightColors } from '../../../shared/utils/theme';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { loginScreenStyles as styles } from './loginScreenStyles';

interface PasswordAuthFormProps {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

/** Password login — secure input + submit button. */
export const PasswordAuthForm: React.FC<PasswordAuthFormProps> = ({ password, onPasswordChange, onSubmit }) => {
  const { t } = useTranslate();
  return (
    <>
      <Text style={styles.authTitle}>{t('login.enterPassword')}</Text>
      <TextInput
        style={styles.passwordInput}
        value={password}
        onChangeText={onPasswordChange}
        placeholder={t('login.passwordPlaceholder')}
        placeholderTextColor={lightColors.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
      />
      <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
        <Text style={styles.submitButtonText}>{t('common.logIn')}</Text>
      </TouchableOpacity>
    </>
  );
};
