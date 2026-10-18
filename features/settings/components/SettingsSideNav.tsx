import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ComposedSettingsTab, SettingsTabKey } from '../services/SettingsTabComposer';
import { settingsScreenStyles as styles } from './settingsScreenStyles';

interface SettingsSideNavProps {
  tabs: ComposedSettingsTab[];
  activeTab: SettingsTabKey;
  onSelectTab: (tab: SettingsTabKey) => void;
}

/** Desktop left-hand settings navigation column. */
export const SettingsSideNav: React.FC<SettingsSideNavProps> = ({ tabs, activeTab, onSelectTab }) => {
  const { colors } = useTheme();
  const { t } = useTranslate();
  return (
    <View style={[styles.sideNav, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.sideNavItem,
            activeTab === tab.key && [styles.sideNavItemActive, { backgroundColor: colors.hover, borderLeftColor: colors.primary }],
          ]}
          onPress={() => tab.status === 'enabled' && onSelectTab(tab.key)}
          disabled={tab.status === 'disabled'}
          accessibilityState={{ disabled: tab.status === 'disabled' }}
        >
          <Text style={styles.sideNavIcon}>{tab.icon}</Text>
          <View style={styles.sideNavLabelWrapper}>
            <Text
              style={[
                styles.sideNavLabel,
                { color: colors.textSecondary },
                activeTab === tab.key && [styles.sideNavLabelActive, { color: colors.primary }],
                tab.status === 'disabled' && styles.sideNavLabelDisabled,
              ]}
            >
              {t(tab.translationKey)}
            </Text>
            {tab.status === 'disabled' && tab.reason ? (
              <Text style={[styles.sideNavSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {tab.reason}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};
