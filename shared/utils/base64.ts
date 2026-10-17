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
