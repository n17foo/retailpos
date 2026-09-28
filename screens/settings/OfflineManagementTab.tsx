import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ProductManagementTab from './ProductManagementTab';
import CategoryManagementTab from './CategoryManagementTab';
import UsersSettingsTab from './UsersSettingsTab';
import { useTranslate } from '../../hooks/useTranslate';
import { useAuthContext } from '../../contexts/AuthProvider';
import { PermissionGate } from '../../components/PermissionGate';
import { permissionService } from '../../services/permissions/PermissionService';
import { elevation, lightColors, semanticColors } from '../../utils/theme';

type OfflineSection = 'overview' | 'products' | 'categories' | 'users';

const OfflineManagementTab: React.FC = () => {
  const { t } = useTranslate();
  const { user } = useAuthContext();
  const canManageUsers = permissionService.canByRole(user?.role, 'user:edit');
  const [activeSection, setActiveSection] = useState<OfflineSection>('overview');

  const renderOverview = () => (
    <ScrollView style={styles.overviewContainer}>
      <Text style={styles.overviewTitle}>{t('settings.offline.title')}</Text>
      <Text style={styles.overviewDescription}>{t('settings.offline.description')}</Text>

      <View style={styles.menuGrid}>
        <TouchableOpacity style={styles.menuCard} onPress={() => setActiveSection('products')}>
          <Text style={styles.menuIcon}>📦</Text>
          <Text style={styles.menuTitle}>{t('settings.offline.products')}</Text>
          <Text style={styles.menuDescription}>{t('settings.offline.productsDescription')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuCard} onPress={() => setActiveSection('categories')}>
          <Text style={styles.menuIcon}>📁</Text>
          <Text style={styles.menuTitle}>{t('settings.offline.categories')}</Text>
          <Text style={styles.menuDescription}>{t('settings.offline.categoriesDescription')}</Text>
        </TouchableOpacity>

        {canManageUsers && (
          <TouchableOpacity style={styles.menuCard} onPress={() => setActiveSection('users')}>
            <Text style={styles.menuIcon}>👥</Text>
            <Text style={styles.menuTitle}>{t('settings.offline.users')}</Text>
            <Text style={styles.menuDescription}>{t('settings.offline.usersDescription')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t('settings.offline.aboutTitle')}</Text>
        <Text style={styles.infoText}>{t('settings.offline.aboutText')}</Text>
      </View>
    </ScrollView>
  );

  const renderBackButton = () => (
    <TouchableOpacity style={styles.backButton} onPress={() => setActiveSection('overview')}>
      <Text style={styles.backButtonText}>{t('settings.offline.backToOverview')}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {activeSection !== 'overview' && renderBackButton()}

      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'products' && <ProductManagementTab />}
      {activeSection === 'categories' && <CategoryManagementTab />}
      {activeSection === 'users' && (
        <PermissionGate action="user:edit">
          <UsersSettingsTab />
        </PermissionGate>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  backButton: {
    backgroundColor: lightColors.surface,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  backButtonText: {
    fontSize: 16,
    color: lightColors.primary,
  },
  overviewContainer: {
    flex: 1,
    padding: 20,
  },
  overviewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  overviewDescription: {
    fontSize: 14,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  menuGrid: {
    gap: 15,
  },
  menuCard: {
    backgroundColor: lightColors.surface,
    borderRadius: 12,
    padding: 20,
    ...elevation.medium,
  },
  menuIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  menuDescription: {
    fontSize: 14,
    color: lightColors.textSecondary,
  },
  infoBox: {
    backgroundColor: semanticColors.hover,
    borderRadius: 12,
    padding: 20,
    marginTop: 30,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: lightColors.primary,
  },
  infoText: {
    fontSize: 14,
    color: lightColors.primary,
    lineHeight: 22,
  },
});

export default OfflineManagementTab;
