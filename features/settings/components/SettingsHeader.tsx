import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { settingsScreenStyles as styles } from './settingsScreenStyles';

interface SettingsHeaderProps {
  showBackButton: boolean;
  onGoBack: () => void;
}

/** Shared settings header — optional back button + centred title. */
export const SettingsHeader: React.FC<SettingsHeaderProps> = ({ showBackButton, onGoBack }) => {
  const { colors } = useTheme();
  const { t } = useTranslate();
  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {showBackButton && (
        <TouchableOpacity style={styles.backButton} onPress={onGoBack}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>{t('settings.backButton')}</Text>
        </TouchableOpacity>
      )}
      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
    </View>
  );
};
