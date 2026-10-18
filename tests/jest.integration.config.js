/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/..'],
  // Only run integration tests
  testMatch: ['**/tests/integration/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  globals: {
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
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  setupFiles: ['<rootDir>/setupEnv.ts'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^react-native-logs$': '<rootDir>/__mocks__/react-native-logs.ts',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^@env$': '<rootDir>/__mocks__/@env.ts',
    '^uuid$': '<rootDir>/__mocks__/uuid.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(react-native|expo-sqlite|react-native-get-random-values)/)'],
  maxWorkers: '50%',
  workerIdleMemoryLimit: '512MB',
};
