import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ComposedSettingsTab, SettingsTabKey } from '../services/SettingsTabComposer';
import { settingsScreenStyles as styles } from './settingsScreenStyles';

interface SettingsTabDropdownProps {
  tabs: ComposedSettingsTab[];
  activeTab: SettingsTabKey;
  activeTabIcon: string;
  activeTabLabel: string;
  onSelectTab: (tab: SettingsTabKey) => void;
}

/** Mobile settings selector — dropdown trigger + modal list (replaces cramped tab bar). */
export const SettingsTabDropdown: React.FC<SettingsTabDropdownProps> = ({
  tabs,
  activeTab,
  activeTabIcon,
  activeTabLabel,
  onSelectTab,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslate();
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handleSelect = (tab: SettingsTabKey) => {
    onSelectTab(tab);
    setDropdownVisible(false);
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        onPress={() => setDropdownVisible(true)}
      >
        <Text style={styles.dropdownIcon}>{activeTabIcon}</Text>
        <Text style={[styles.dropdownLabel, { color: colors.textPrimary }]}>{activeTabLabel}</Text>
        <Text style={[styles.dropdownArrow, { color: colors.textSecondary }]}>▾</Text>
      </TouchableOpacity>

      <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface }]}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: colors.divider },
                  activeTab === tab.key && [styles.dropdownItemActive, { backgroundColor: colors.hover }],
                ]}
                onPress={() => tab.status === 'enabled' && handleSelect(tab.key)}
                disabled={tab.status === 'disabled'}
              >
                <Text style={styles.dropdownItemIcon}>{tab.icon}</Text>
                <View style={styles.dropdownItemLabelWrapper}>
                  <Text
                    style={[
                      styles.dropdownItemText,
                      { color: colors.textPrimary },
                      activeTab === tab.key && [styles.dropdownItemTextActive, { color: colors.primary }],
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
                {activeTab === tab.key && <Text style={[styles.dropdownCheck, { color: colors.primary }]}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
