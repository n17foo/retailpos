/**
 * Mock for react-native-get-random-values.
 *
 * The real package only polyfills `crypto.getRandomValues` on React Native.
 * Jest runs on Node 22 where `globalThis.crypto.getRandomValues` is native,
 * so this is a no-op. The package's index.js also fails to parse under
 * Jest's CJS wrapper (`let module` collides with the module parameter).
 */
export {};
