import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { loginScreenStyles as styles } from './loginScreenStyles';

interface CardSwipeAuthFormProps {
  variant: 'magstripe' | 'rfid_nfc';
  waitingForSwipe: boolean;
  onCardInput: (cardData: string) => void;
}

/** Mag-stripe / RFID badge login — hidden auto-focus input captures the swipe/tap. */
export const CardSwipeAuthForm: React.FC<CardSwipeAuthFormProps> = ({ variant, waitingForSwipe, onCardInput }) => {
  const { t } = useTranslate();
  const isMagstripe = variant === 'magstripe';
  return (
    <>
      <Text style={styles.authTitle}>{isMagstripe ? t('login.swipeCard') : t('login.tapBadge')}</Text>
      <Text style={styles.authDescription}>{isMagstripe ? t('login.swipeCardDescription') : t('login.tapBadgeDescription')}</Text>
      <View style={styles.waitingIconContainer}>
        <MaterialIcons name={isMagstripe ? 'credit-card' : 'nfc'} size={64} color={lightColors.primary} />
      </View>
      <TextInput style={styles.hiddenInput} autoFocus onChangeText={onCardInput} value="" blurOnSubmit={false} />
      <Text style={styles.waitingText}>
        {waitingForSwipe ? (isMagstripe ? t('login.waitingForSwipe') : t('login.waitingForTap')) : t('common.ready')}
      </Text>
    </>
  );
};
