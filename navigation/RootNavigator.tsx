import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthContext } from '../contexts/AuthProvider';
import { useOnboardingContext } from '../contexts/OnboardingProvider';
import { AuthNavigator } from './AuthNavigator';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';
import { User } from '../repositories/UserRepository';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root Navigator
 * Main navigation container that handles authentication flow
 */
export const RootNavigator: React.FC = () => {
  const { isAuthenticated, setIsAuthenticated, user, setUser } = useAuthContext();
  const { isOnboarded } = useOnboardingContext();
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);

  // Handle login with PIN
  const handleLogin = (pin: string, loggedInUser?: User) => {
    if (pin && pin.length === 6) {
      // If user object provided from database, use it; otherwise fallback for development
      const userData = loggedInUser
        ? { username: loggedInUser.name, pin, id: loggedInUser.id, role: loggedInUser.role }
        : { username: 'Staff', pin };
      setUser(userData);
      setIsAuthenticated(true);
      console.log('Login successful:', loggedInUser ? `User: ${loggedInUser.name}` : 'Development mode');
    }
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  // Handle order completion
  const handleOrderComplete = (orderTotal: number, items: any[]) => {
    const newOrder = {
      id: Date.now().toString(),
      total: orderTotal,
      items: items,
      date: new Date().toISOString(),
      user: user?.username || 'anonymous',
    };

    setCompletedOrders(prev => [...prev, newOrder]);
    console.log('Order completed:', newOrder);
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
          <Stack.Screen name="Main">
            {() => <MainTabNavigator username={user?.username || ''} onOrderComplete={handleOrderComplete} onLogout={handleLogout} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
