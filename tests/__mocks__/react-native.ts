/**
 * Mock for react-native module
 * Used in Jest tests to avoid native module dependencies while supporting
 * full component & screen rendering via react-test-renderer.
 */
import React from 'react';

export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  Version: 14,
  select: jest.fn((obj: Record<string, unknown>) => obj.ios ?? obj.default),
};

export const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
};

export const useWindowDimensions = jest.fn(() => ({
  width: 1024,
  height: 768,
  scale: 2,
  fontScale: 1,
}));

export const StyleSheet = {
  create: jest.fn(<T extends Record<string, unknown>>(styles: T): T => styles),
  flatten: jest.fn((style: unknown) => style),
  hairlineWidth: 1,
  absoluteFill: {},
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

export const Alert = {
  alert: jest.fn(),
  prompt: jest.fn(),
};

export const Share = {
  share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
  sharedAction: 'sharedAction',
  dismissedAction: 'dismissedAction',
};

export const I18nManager = {
  isRTL: false,
  forceRTL: jest.fn(),
  allowRTL: jest.fn(),
};

export const Linking = {
  openURL: jest.fn().mockResolvedValue(undefined),
  canOpenURL: jest.fn().mockResolvedValue(true),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
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

export class AnimatedValue {
  private _value: number;
  constructor(val: number) {
    this._value = val;
  }
  setValue(val: number): void {
    this._value = val;
  }
  interpolate(_config: unknown): AnimatedValue {
    return this;
  }
  addListener(): string {
    return '1';
  }
  removeListener(): void {}
  removeAllListeners(): void {}
  stopAnimation(cb?: (value: number) => void): void {
    cb?.(this._value);
  }
}

const createAnimComposite = () => ({
  start: (cb?: (result: { finished: boolean }) => void) => cb?.({ finished: true }),
  stop: jest.fn(),
  reset: jest.fn(),
});

export const Animated = {
  Value: AnimatedValue,
  View: 'Animated.View',
  Text: 'Animated.Text',
  Image: 'Animated.Image',
  ScrollView: 'Animated.ScrollView',
  timing: jest.fn(() => createAnimComposite()),
  spring: jest.fn(() => createAnimComposite()),
  sequence: jest.fn(() => createAnimComposite()),
  parallel: jest.fn(() => createAnimComposite()),
  loop: jest.fn(() => createAnimComposite()),
  event: jest.fn(() => jest.fn()),
};

export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  quad: (t: number) => t * t,
  cubic: (t: number) => t * t * t,
  bezier: () => (t: number) => t,
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => fn,
  inOut: (fn: (t: number) => number) => fn,
};

export const PanResponder = {
  create: jest.fn(() => ({ panHandlers: {} })),
};

// Mock React Native host components
export const View = 'View';
export const Text = 'Text';
const TextInputComponent = (props: Record<string, unknown>) => React.createElement('TextInput', props, props.children as React.ReactNode);
export const TextInput = Object.assign(TextInputComponent, {
  State: {
    currentlyFocusedInput: jest.fn(() => null),
  },
});
export const ScrollView = 'ScrollView';
export const TouchableOpacity = 'TouchableOpacity';
export const TouchableHighlight = 'TouchableHighlight';
export const TouchableWithoutFeedback = 'TouchableWithoutFeedback';
export const Image = 'Image';
export const SectionList = 'SectionList';
export const ActivityIndicator = 'ActivityIndicator';
export const Modal = ({ visible = true, children, ...rest }: { visible?: boolean; children?: React.ReactNode }) =>
  visible ? React.createElement('Modal', rest, children) : null;
export const Switch = 'Switch';
export const Button = ({ title, onPress, disabled, ...rest }: { title: string; onPress?: () => void; disabled?: boolean }) =>
  React.createElement('Button', { title, onPress, disabled, ...rest }, React.createElement('Text', null, title));
export const Pressable = 'Pressable';
export const RefreshControl = 'RefreshControl';
export const StatusBar = 'StatusBar';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const SafeAreaView = 'SafeAreaView';

const renderSlot = (slot: React.ComponentType | React.ReactElement | null | undefined) => {
  if (!slot) return null;
  return typeof slot === 'function' ? React.createElement(slot) : slot;
};

export const FlatList = <T>({
  data,
  renderItem,
  keyExtractor,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  ...rest
}: {
  data?: ReadonlyArray<T> | null;
  renderItem?: (info: {
    item: T;
    index: number;
    separators: { highlight: () => void; unhighlight: () => void; updateProps: () => void };
  }) => React.ReactElement | null;
  keyExtractor?: (item: T, index: number) => string;
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
}) => {
  const items = data ?? [];
  const separators = { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} };
  return React.createElement(
    'FlatList',
    rest,
    renderSlot(ListHeaderComponent),
    items.length > 0
      ? items.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem ? renderItem({ item, index, separators }) : null
          )
        )
      : renderSlot(ListEmptyComponent),
    renderSlot(ListFooterComponent)
  );
};

export default {
  Platform,
  Dimensions,
  useWindowDimensions,
  StyleSheet,
  Alert,
  Share,
  I18nManager,
  Linking,
  AppState,
  Keyboard,
  PixelRatio,
  Animated,
  Easing,
  PanResponder,
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
  RefreshControl,
  StatusBar,
  KeyboardAvoidingView,
  SafeAreaView,
};
