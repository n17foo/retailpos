/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  globals: {
    // React Native global — not defined in the node test environment
    __DEV__: true,
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        diagnostics: false,
      },
    ],
  },
  // Limit workers to reduce OS-level race on worker process teardown
  maxWorkers: '50%',
  // Give workers extra time to exit cleanly before Jest force-kills them
  workerIdleMemoryLimit: '512MB',
};
