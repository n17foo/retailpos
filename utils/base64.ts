/**
 * Base64 encoding/decoding utilities for React Native
 * Node.js Buffer is not available in React Native, so we use these utilities instead
 */

/**
 * Encode a string to Base64
 * Works in both React Native and Node.js environments
 */
export function encodeBase64(str: string): string {
  // For React Native, use btoa if available (most modern RN versions)
  if (typeof btoa !== 'undefined') {
    return btoa(str);
  }

  // Fallback: manual Base64 encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  for (let i = 0; i < str.length; i += 3) {
    const char1 = str.charCodeAt(i);
    const char2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
    const char3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;

    const enc1 = char1 >> 2;
    const enc2 = ((char1 & 3) << 4) | (isNaN(char2) ? 0 : char2 >> 4);
    const enc3 = isNaN(char2) ? 64 : ((char2 & 15) << 2) | (isNaN(char3) ? 0 : char3 >> 6);
    const enc4 = isNaN(char3) ? 64 : char3 & 63;

    output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
  }

  return output;
}

/**
 * Decode a Base64 string
 * Works in both React Native and Node.js environments
 */
export function decodeBase64(str: string): string {
  // For React Native, use atob if available
  if (typeof atob !== 'undefined') {
    return atob(str);
  }

  // Fallback: manual Base64 decoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  // Remove any characters not in the Base64 alphabet
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');

  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));

    const char1 = (enc1 << 2) | (enc2 >> 4);
    const char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const char3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(char1);
    if (enc3 !== 64) output += String.fromCharCode(char2);
    if (enc4 !== 64) output += String.fromCharCode(char3);
  }

  return output;
}

/**
 * Create Basic Auth header value from credentials
 * @param username The username or API key
 * @param password The password or API secret
 * @returns The Base64 encoded credentials for Basic Auth
 */
export function createBasicAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return `Basic ${encodeBase64(credentials)}`;
}
