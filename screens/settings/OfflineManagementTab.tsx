import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import ProductManagementTab from './ProductManagementTab';
import CategoryManagementTab from './CategoryManagementTab';
import UsersSettingsTab from './UsersSettingsTab';

type OfflineSection = 'overview' | 'products' | 'categories' | 'users';

const OfflineManagementTab: React.FC = () => {
  const [activeSection, setActiveSection] = useState<OfflineSection>('overview');

  const renderOverview = () => (
    <ScrollView style={styles.overviewContainer}>
      <Text style={styles.overviewTitle}>Offline Mode Management</Text>
      <Text style={styles.overviewDescription}>
        Manage your local products, categories, and users for offline POS operation. All data is stored locally on this device using SQLite.
      </Text>

      <View style={styles.menuGrid}>
        <TouchableOpacity style={styles.menuCard} onPress={() => setActiveSection('products')}>
          <Text style={styles.menuIcon}>📦</Text>
          <Text style={styles.menuTitle}>Products</Text>
          <Text style={styles.menuDescription}>Create, edit, and manage your product catalog</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuCard} onPress={() => setActiveSection('categories')}>
          <Text style={styles.menuIcon}>📁</Text>
          <Text style={styles.menuTitle}>Categories</Text>
          <Text style={styles.menuDescription}>Organize products into categories</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuCard} onPress={() => setActiveSection('users')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuTitle}>Users</Text>
          <Text style={styles.menuDescription}>Manage staff accounts and roles</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>About Offline Mode</Text>
        <Text style={styles.infoText}>
          • All data is stored locally on this device{'\n'}• No internet connection required for operation{'\n'}• Products can be added to
          basket and orders completed{'\n'}• User roles: Admin, Manager, Cashier, Service Staff{'\n'}• Data persists across app restarts
        </Text>
      </View>
    </ScrollView>
  );

  const renderBackButton = () => (
    <TouchableOpacity style={styles.backButton} onPress={() => setActiveSection('overview')}>
      <Text style={styles.backButtonText}>← Back to Overview</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {activeSection !== 'overview' && renderBackButton()}

      {activeSection === 'overview' && renderOverview()}
      {activeSection === 'products' && <ProductManagementTab />}
      {activeSection === 'categories' && <CategoryManagementTab />}
      {activeSection === 'users' && <UsersSettingsTab />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
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
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  menuGrid: {
    gap: 15,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 20,
    marginTop: 30,
    marginBottom: 30,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#1565c0',
  },
  infoText: {
    fontSize: 14,
    color: '#1976d2',
    lineHeight: 22,
  },
});

export default OfflineManagementTab;
