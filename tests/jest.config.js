/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/..'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  globals: {
    // React Native global — not defined in the node test environment
    __DEV__: true,
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
        diagnostics: false,
      },
    ],
  },
  // Setup file to run before tests
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  // Setup file to run before environment is created
  setupFiles: ['<rootDir>/setupEnv.ts'],
  // Module name mapper for mocking native modules
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^react-native-logs$': '<rootDir>/__mocks__/react-native-logs.ts',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^react-native-get-random-values$': '<rootDir>/__mocks__/react-native-get-random-values.ts',
    '^@env$': '<rootDir>/__mocks__/@env.ts',
    '^uuid$': '<rootDir>/__mocks__/uuid.ts',
    '^@expo/vector-icons$': '<rootDir>/__mocks__/uiMocks.ts',
    '^@shopify/flash-list$': '<rootDir>/__mocks__/uiMocks.ts',
    '^@react-navigation/native$': '<rootDir>/__mocks__/uiMocks.ts',
    '^@react-navigation/native-stack$': '<rootDir>/__mocks__/uiMocks.ts',
    '^@react-navigation/bottom-tabs$': '<rootDir>/__mocks__/uiMocks.ts',
    '^react-native-safe-area-context$': '<rootDir>/__mocks__/uiMocks.ts',
    '^react-native-gesture-handler$': '<rootDir>/__mocks__/uiMocks.ts',
    '^react-native-ble-plx$': '<rootDir>/__mocks__/uiMocks.ts',
    '^react-i18next$': '<rootDir>/__mocks__/uiMocks.ts',
    '^expo-image$': '<rootDir>/__mocks__/uiMocks.ts',
    '^expo-camera$': '<rootDir>/__mocks__/uiMocks.ts',
    '^expo-constants$': '<rootDir>/__mocks__/uiMocks.ts',
    '^expo-file-system$': '<rootDir>/__mocks__/uiMocks.ts',
    '^expo-sharing$': '<rootDir>/__mocks__/uiMocks.ts',
    '^expo-localization$': '<rootDir>/__mocks__/uiMocks.ts',
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.ts',
  },
  // Transform node_modules that use ES modules
  transformIgnorePatterns: ['node_modules/(?!(react-native|expo-sqlite|react-native-get-random-values)/)'],
  // Limit workers to reduce OS-level race on worker process teardown
  maxWorkers: '50%',
  // Give workers extra time to exit cleanly before Jest force-kills them
  workerIdleMemoryLimit: '512MB',
};
