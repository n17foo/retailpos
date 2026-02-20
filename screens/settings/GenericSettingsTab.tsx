import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslate } from '../../hooks/useTranslate';
import { availableLanguages } from '../../locales/i18n';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';

const GenericSettingsTab = () => {
  const { t, getCurrentLanguage, changeLanguage } = useTranslate();
  const [selectedLanguage, setSelectedLanguage] = useState(getCurrentLanguage());

  // Update the selected language when the current language changes
  useEffect(() => {
    setSelectedLanguage(getCurrentLanguage());
  }, [getCurrentLanguage]);

  // Handle language selection
  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    changeLanguage(langCode);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.general.languageTitle')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.general.languageDescription')}</Text>

        <View style={styles.languageOptions}>
          {availableLanguages.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.languageOption, selectedLanguage === lang.code && styles.selectedLanguageOption]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[styles.languageName, selectedLanguage === lang.code && styles.selectedLanguageText]}>{lang.name}</Text>
              {selectedLanguage === lang.code && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.general.dateTimeTitle')}</Text>
        <Text style={styles.sectionDescription}>{t('settings.general.dateTimeDescription')}</Text>

        {/* Date format options would go here in a future implementation */}
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>{t('common.comingSoon')}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold as 'bold',
    marginBottom: spacing.xs,
    color: lightColors.textPrimary,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.md,
  },
  languageOptions: {
    marginTop: spacing.xs,
  },
  languageOption: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    backgroundColor: lightColors.background,
  },
  selectedLanguageOption: {
    borderColor: lightColors.primary,
    backgroundColor: `${lightColors.primary}15`,
  },
  languageName: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  selectedLanguageText: {
    fontWeight: typography.fontWeight.bold as 'bold',
    color: lightColors.primary,
  },
  checkmark: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold as 'bold',
    color: lightColors.primary,
  },
  comingSoon: {
    padding: spacing.md,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    alignItems: 'center' as const,
  },
  comingSoonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontStyle: 'italic' as const,
  },
});

export default GenericSettingsTab;
