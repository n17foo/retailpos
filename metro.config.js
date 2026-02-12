// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Tree shaking: remove unused exports in production builds
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    compress: {
      // Remove console.log in production
      drop_console: process.env.NODE_ENV === 'production',
      // Remove dead code
      dead_code: true,
      // Collapse single-use variables
      collapse_vars: true,
      // Reduce code size
      reduce_vars: true,
      // Remove unreachable code
      unused: true,
    },
    mangle: {
      toplevel: false,
    },
    output: {
      // Remove comments in production
      comments: process.env.NODE_ENV !== 'production',
    },
  },
};

// Add .wasm to asset extensions for expo-sqlite web support
config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'wasm'],
};

module.exports = config;
