import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import UsersSettingsTab from './settings/UsersSettingsTab';
import { lightColors, spacing } from '../utils/theme';

interface UsersScreenProps {}

const UsersScreen: React.FC<UsersScreenProps> = () => {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        <UsersSettingsTab />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  scrollContainer: {
    flex: 1,
    padding: spacing.md,
  },
});

export default UsersScreen;
