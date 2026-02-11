const js = require('@eslint/js');
const ts = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const prettier = require('eslint-plugin-prettier');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactNative = require('eslint-plugin-react-native');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.expo-shared/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'electron/**',
      '*.config.js',
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        __DEV__: 'readonly',
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        alert: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-native': reactNative,
      prettier: prettier,
    },
    rules: {
      // React
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native
      'react-native/no-unused-styles': 'warn',
      'react-native/split-platform-components': 'warn',
      'react-native/no-inline-styles': 'warn',
      'react-native/no-color-literals': 'warn',
      'react-native/no-raw-text': 'off',

      // TypeScript
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // Prettier
      'prettier/prettier': ['error'],

      // Disable base rules that conflict with TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettierConfig,
];
