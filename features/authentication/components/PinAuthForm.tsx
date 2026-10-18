import React from 'react';
import { Text } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import PinKeypad from './PinKeypad';
import PinDisplay from './PinDisplay';
import { loginScreenStyles as styles } from './loginScreenStyles';

interface PinAuthFormProps {
  pinLength: number;
  filledCount: number;
  biometricAvailable: boolean;
  onKeyPress: (key: string) => void;
  onDelete: () => void;
}

/** PIN login — dot display + numeric keypad (biometric key when available). */
export const PinAuthForm: React.FC<PinAuthFormProps> = ({ pinLength, filledCount, biometricAvailable, onKeyPress, onDelete }) => {
  const { t } = useTranslate();
  return (
    <>
      <Text style={styles.authTitle}>{t('login.enterPin')}</Text>
      <PinDisplay pinLength={pinLength} filledCount={filledCount} />
      <PinKeypad onKeyPress={onKeyPress} onDeletePress={onDelete} disableBiometric={!biometricAvailable} />
    </>
  );
};
