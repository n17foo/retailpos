import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { interactionStyle } from '../../../shared/utils/theme';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { checkoutModalStyles as styles } from './checkoutModalStyles';

interface CheckoutModalHeaderProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  disabled?: boolean;
}

/** Shared checkout modal header — optional back button, centred title, close button. */
export const CheckoutModalHeader: React.FC<CheckoutModalHeaderProps> = ({ title, onClose, onBack, disabled = false }) => {
  const { t } = useTranslate();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={state => [styles.backButton, interactionStyle(state)]}
          disabled={disabled}
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
      ) : null}
      <Text style={styles.headerTitle}>{title}</Text>
      <Pressable
        onPress={onClose}
        style={state => [styles.closeButton, interactionStyle(state)]}
        disabled={disabled}
        accessibilityLabel={t('checkout.cancelCheckout')}
        accessibilityRole="button"
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
};
