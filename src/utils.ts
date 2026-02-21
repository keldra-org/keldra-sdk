import { KeldraError } from './errors.js';

export function parseHex(hexStr: string): Uint8Array {
  const cleaned = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  if (cleaned.length === 0) {
    throw KeldraError.invalidTransaction('empty transaction');
  }
  if (cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
    throw KeldraError.invalidTransaction(`invalid hex: ${hexStr}`);
  }
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function extractErrorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === 'string') return parsed.error;
  } catch {}
  return body;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
