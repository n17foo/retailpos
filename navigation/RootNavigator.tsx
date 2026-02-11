import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthContext } from '../contexts/AuthProvider';
import { useOnboardingContext } from '../contexts/OnboardingProvider';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';
import { User } from '../repositories/UserRepository';
import { logger } from '../services/logger';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator
 * Main navigation container that handles authentication flow
 */
export const RootNavigator: React.FC = () => {
  const { isAuthenticated, setIsAuthenticated, user, setUser } = useAuthContext();
  const { isOnboarded } = useOnboardingContext();

  // Handle login with PIN
  const handleLogin = (pin: string, loggedInUser?: User) => {
    if (pin && pin.length === 6) {
      // If user object provided from database, use it; otherwise fallback for development
      const userData = loggedInUser
        ? { username: loggedInUser.name, pin, id: loggedInUser.id, role: loggedInUser.role }
        : { username: 'Staff', pin };
      setUser(userData);
      setIsAuthenticated(true);
      logger.info({ message: `Login successful: ${loggedInUser ? `User: ${loggedInUser.name}` : 'Development mode'}` });
    }
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
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
          <Stack.Screen name="Main">{() => <MainTabNavigator username={user?.username || ''} onLogout={handleLogout} />}</Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
