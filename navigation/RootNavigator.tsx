import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthContext } from '../contexts/AuthProvider';
import { useOnboardingContext } from '../contexts/OnboardingProvider';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';
import { User } from '../repositories/UserRepository';
import { useLogger } from '../hooks/useLogger';
import { auditLogService } from '../services/audit/AuditLogService';
import { useInactivityLock } from '../hooks/useInactivityLock';
import { warmUpPlatformToken } from '../services/token/TokenUtils';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator
 * Main navigation container that handles authentication flow
 */
export const RootNavigator: React.FC = () => {
  const { isAuthenticated, setIsAuthenticated, user, setUser } = useAuthContext();
  const { isOnboarded } = useOnboardingContext();
  const logger = useLogger('RootNavigator');

  // Handle login with PIN
  const handleLogin = (loggedInUser: User) => {
    if (!loggedInUser.id || !loggedInUser.is_active) {
      return;
    }

    const userData = {
      username: loggedInUser.name,
      id: loggedInUser.id,
      role: loggedInUser.role,
    };

    setUser(userData);
    setIsAuthenticated(true);
    logger.info({ message: `Login successful: ${loggedInUser ? `User: ${loggedInUser.name}` : 'Development mode'}` });

    // Once the staff member has authenticated, warm up the platform access
    // token from the locally stored credentials so the first API call is fast.
    void warmUpPlatformToken().then(({ platform, acquired }) => {
      if (!platform) return;
      auditLogService.log('auth:platform_token', {
        userId: userData.id,
        userName: userData.username,
        details: acquired ? `Acquired ${platform} access token from stored credentials` : `Failed to acquire ${platform} access token`,
      });
    });
  };

  // Handle logout
  const handleLogout = (details: string = 'User logged out') => {
    // Log logout event (spec: audit.md §2.1.3)
    auditLogService.log('auth:logout', {
      userId: user?.id,
      userName: user?.username,
      details,
    });

    setUser(null);
    setIsAuthenticated(false);
  };

  const registerActivity = useInactivityLock(isAuthenticated, () => handleLogout('Session locked after inactivity'));

  return (
    <View
      style={styles.activityCapture}
      onStartShouldSetResponderCapture={() => {
        registerActivity();
        return false;
      }}
    >
      <NavigationContainer>
        <Stack.Navigator
          id="RootStack"
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          {!isAuthenticated ? (
            <Stack.Screen name="Auth">{() => <AuthNavigator onLogin={handleLogin} showOnboarding={!isOnboarded} />}</Stack.Screen>
          ) : (
            <Stack.Screen name="Main">
              {() => <MainTabNavigator username={user?.username || ''} userRole={user?.role} onLogout={() => handleLogout()} />}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  activityCapture: {
    flex: 1,
  },
});

export default RootNavigator;
