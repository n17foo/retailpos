import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

/**
 * Root Stack - Authentication flow
 */
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

/**
 * Auth Stack - Login and Onboarding screens
 */
export type AuthStackParamList = {
  Login: undefined;
  Onboarding: undefined;
};

/**
 * Main Tab Navigator - Bottom tabs after login
 */
export type MainTabParamList = {
  Order: undefined;
  Scan: undefined;
  Search: undefined;
  Inventory: undefined;
  More: NavigatorScreenParams<MoreStackParamList>;
};

/**
 * More Stack - Settings, Refunds, etc (accessible from More tab)
 */
export type MoreStackParamList = {
  MoreMenu: undefined;
  Settings: undefined;
  Users: undefined;
  Refund: undefined;
  Printer: undefined;
  PaymentTerminal: { amount?: number; items?: any[] };
  DailyOrders: undefined;
};

/**
 * Screen Props Types
 */

// Root Stack
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

// Auth Stack
export type AuthStackScreenProps<T extends keyof AuthStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<AuthStackParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// Main Tab
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// More Stack
export type MoreStackScreenProps<T extends keyof MoreStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<MoreStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

/**
 * Declare global navigation types for useNavigation hook
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
