import React from 'react';
import { Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ComposedSettingsTab, SettingsTabKey } from '../services/SettingsTabComposer';
import { settingsScreenStyles as styles } from './settingsScreenStyles';

interface SettingsTabBarProps {
  tabs: ComposedSettingsTab[];
  activeTab: SettingsTabKey;
  onSelectTab: (tab: SettingsTabKey) => void;
}

/** Tablet horizontal scrollable settings tab bar. */
export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({ tabs, activeTab, onSelectTab }) => {
  const { colors } = useTheme();
  const { t } = useTranslate();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabBarScroll, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      contentContainerStyle={styles.tabBarContent}
    >
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && [styles.activeTab, { borderBottomColor: colors.primary }],
            tab.status === 'disabled' && styles.tabDisabled,
          ]}
          onPress={() => tab.status === 'enabled' && onSelectTab(tab.key)}
          disabled={tab.status === 'disabled'}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === tab.key && [styles.activeTabText, { color: colors.primary }],
            ]}
          >
            {t(tab.translationKey)}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};
