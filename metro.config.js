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
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      // Critical: inline requires for better performance and smaller bundles
      inlineRequires: true,
    },
  }),
};

// ---------------------------------------------------------------------------
// Native-only SDKs that must never be bundled for web.
//
// These packages import react-native internals (codegenNativeComponent, etc.)
// that are not available in the web/Electron bundle. When Metro resolves one
// of these on the web platform it returns an empty module stub instead of
// attempting to bundle the native code.
// ---------------------------------------------------------------------------
const NATIVE_ONLY_MODULES = new Set([
  '@adyen/react-native',
  'card-react-native',
  'react-native-square-in-app-payments',
  '@stripe/stripe-terminal-react-native',
]);

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver = {
  ...config.resolver,
  assetExts: [...config.resolver.assetExts, 'wasm'],
  resolveRequest: (context, moduleName, platform) => {
    // On web, stub out native-only modules so they never reach the bundler.
    if (platform === 'web' && NATIVE_ONLY_MODULES.has(moduleName)) {
      return {
        type: 'empty',
      };
    }
    // Fall through to the default resolver (or any previously set custom one).
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
