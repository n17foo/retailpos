/**
 * Mock for react-native module
 * Used in Jest tests to avoid native module dependencies
 */

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  Version: 14,
  select: jest.fn((obj: Record<string, unknown>) => obj.ios || obj.default),
};

export const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

export const StyleSheet = {
  create: jest.fn(styles => styles),
  flatten: jest.fn(style => style),
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: {},
};

export const Alert = {
  alert: jest.fn(),
  prompt: jest.fn(),
};

export const Linking = {
  openURL: jest.fn().mockResolvedValue(undefined),
  canOpenURL: jest.fn().mockResolvedValue(true),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

export const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};

export const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeListener: jest.fn(),
};

export const PixelRatio = {
  get: jest.fn(() => 2),
  getFontScale: jest.fn(() => 1),
  getPixelSizeForLayoutSize: jest.fn((size: number) => size * 2),
  roundToNearestPixel: jest.fn((size: number) => Math.round(size)),
};

// Mock React Native components
export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const TouchableOpacity = 'TouchableOpacity';
export const TouchableHighlight = 'TouchableHighlight';
export const TouchableWithoutFeedback = 'TouchableWithoutFeedback';
export const Image = 'Image';
export const FlatList = 'FlatList';
export const SectionList = 'SectionList';
export const ActivityIndicator = 'ActivityIndicator';
export const Modal = 'Modal';
export const Switch = 'Switch';
export const Button = 'Button';
export const Pressable = 'Pressable';

export default {
  Platform,
  Dimensions,
  StyleSheet,
  Alert,
  Linking,
  AppState,
  Keyboard,
  PixelRatio,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  Image,
  FlatList,
  SectionList,
  ActivityIndicator,
  Modal,
  Switch,
  Button,
  Pressable,
};
