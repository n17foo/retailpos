import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import type { AuthStackParamList } from './types';
import { User } from '../repositories/UserRepository';

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthNavigatorProps {
  onLogin: (pin: string, user?: User) => void;
  showOnboarding: boolean;
}

/**
 * Authentication Navigator
 * Handles login and onboarding flow
 */
export const AuthNavigator: React.FC<AuthNavigatorProps> = ({ onLogin, showOnboarding }) => {
  return (
    <Stack.Navigator
      id="AuthStack"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
      initialRouteName={showOnboarding ? 'Onboarding' : 'Login'}
    >
      {showOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <Stack.Screen name="Login">{props => <LoginScreen {...props} onLogin={onLogin} />}</Stack.Screen>
      )}
    </Stack.Navigator>
  );
};

export default AuthNavigator;
