import React from 'react';
import { FlatList, ScrollView } from './react-native';

export { ScrollView };

export const MaterialIcons = (props: Record<string, unknown>) => React.createElement('MaterialIcons', props);
export const Ionicons = (props: Record<string, unknown>) => React.createElement('Ionicons', props);
export const Feather = (props: Record<string, unknown>) => React.createElement('Feather', props);
export const FontAwesome = (props: Record<string, unknown>) => React.createElement('FontAwesome', props);

export const FlashList = FlatList;

export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();
export const mockSetOptions = jest.fn();
export const mockRouteParams: Record<string, unknown> = { email: 'alice@example.com' };

export const useNavigation = jest.fn(() => ({
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: mockSetOptions,
  addListener: jest.fn(() => jest.fn()),
}));

export const useRoute = jest.fn(() => ({
  key: 'test-route',
  name: 'TestRoute',
  params: mockRouteParams,
}));

export const useIsFocused = jest.fn(() => true);
export const useFocusEffect = jest.fn((cb: () => void) => cb());

export const NavigationContainer = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('NavigationContainer', null, children);

const createMockNavigator = () => {
  const Navigator = ({ initialRouteName, children }: { initialRouteName?: string; children?: React.ReactNode }) => {
    const nav = useNavigation();
    const route = useRoute();
    const childArray = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<{
      name: string;
      component?: React.ComponentType<Record<string, unknown>>;
      children?: (props: { navigation: unknown; route: unknown }) => React.ReactNode;
    }>[];
    const activeName = initialRouteName ?? childArray[0]?.props.name;
    return React.createElement(
      'Navigator',
      { initialRouteName: activeName },
      childArray.map(child => {
        const isActive = child.props.name === activeName;
        const Comp = child.props.component;
        const renderFn = child.props.children;
        return React.createElement(
          'Screen',
          { key: child.props.name, name: child.props.name },
          isActive
            ? Comp
              ? React.createElement(Comp, { navigation: nav, route })
              : typeof renderFn === 'function'
                ? renderFn({ navigation: nav, route })
                : null
            : null
        );
      })
    );
  };

  const Screen = ({ name }: { name: string; [key: string]: unknown }) => React.createElement('Screen', { name });
  return { Navigator, Screen };
};

export const createNativeStackNavigator = jest.fn(() => createMockNavigator());
export const createBottomTabNavigator = jest.fn(() => createMockNavigator());

export const SafeAreaProvider = ({ children }: { children?: React.ReactNode }) => React.createElement('SafeAreaProvider', null, children);
export const SafeAreaView = ({ children, ...rest }: { children?: React.ReactNode }) => React.createElement('SafeAreaView', rest, children);
export const useSafeAreaInsets = jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 }));

export const GestureHandlerRootView = ({ children, ...rest }: { children?: React.ReactNode }) =>
  React.createElement('GestureHandlerRootView', rest, children);

export const Image = Object.assign((props: Record<string, unknown>) => React.createElement('ExpoImage', props), {
  prefetch: jest.fn(),
  clearMemoryCache: jest.fn().mockResolvedValue(undefined),
  clearDiskCache: jest.fn().mockResolvedValue(undefined),
});

export const CameraView = (props: Record<string, unknown>) => React.createElement('CameraView', props);
export const useCameraPermissions = jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn()]);

export const Paths = {
  cache: '/tmp/cache',
  document: '/tmp/doc',
};

export class File {
  uri: string;
  constructor(...parts: string[]) {
    this.uri = parts.join('/');
  }
  write = jest.fn();
}

export const isAvailableAsync = jest.fn().mockResolvedValue(true);
export const shareAsync = jest.fn().mockResolvedValue(undefined);
export const getLocales = jest.fn(() => [{ languageCode: 'en', languageTag: 'en-US' }]);

export const useTranslation = jest.fn(() => ({
  t: (key: string, opts?: Record<string, unknown> | string) => {
    if (typeof opts === 'string') return opts;
    if (opts && typeof opts.defaultValue === 'string') return opts.defaultValue;
    return key;
  },
  i18n: {
    language: 'en',
    changeLanguage: jest.fn().mockResolvedValue(undefined),
  },
  ready: true,
}));

export const I18nextProvider = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
export const initReactI18next = { type: '3rdParty', init: jest.fn() };

export class BleManager {
  destroy = jest.fn();
}

export default {
  appOwnership: null,
  expoConfig: {},
};
