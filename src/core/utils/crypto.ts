const ENCRYPTION_KEY = 'eazycheck-local-v1';

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const xorEncrypt = (text: string, key: string): string => {
  if (!text) return '';
  const result: number[] = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return toBase64(new Uint8Array(result).buffer);
};

const xorDecrypt = (encoded: string, key: string): string => {
  if (!encoded) return '';
  try {
    const bytes = fromBase64(encoded);
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
};

export const encryptSensitive = (value: string): string =>
  xorEncrypt(value, ENCRYPTION_KEY);

export const decryptSensitive = (value: string): string =>
  xorDecrypt(value, ENCRYPTION_KEY);

export const maskAadhaar = (value: string): string => {
  if (!value || value.length < 4) return '****';
  return `XXXX-XXXX-${value.slice(-4)}`;
};
