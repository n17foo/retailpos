import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslate } from '../../hooks/useTranslate';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';

// Define available languages for the app
const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

const GenericSettingsTab = () => {
  const { getCurrentLanguage, changeLanguage } = useTranslate();
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
        <Text style={styles.sectionTitle}>Language Settings</Text>
        <Text style={styles.sectionDescription}>Change the display language for the RetailPOS application</Text>

        <View style={styles.languageOptions}>
          {AVAILABLE_LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.languageOption, selectedLanguage === lang.code && styles.selectedLanguageOption]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text style={[styles.languageName, selectedLanguage === lang.code && styles.selectedLanguageText]}>
                {lang.name} {lang.nativeName && `(${lang.nativeName})`}
              </Text>
              {selectedLanguage === lang.code && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date & Time Format</Text>
        <Text style={styles.sectionDescription}>Configure date and time display formats</Text>

        {/* Date format options would go here in a future implementation */}
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
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
