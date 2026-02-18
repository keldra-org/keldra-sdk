import { describe, it, expect } from 'vitest';
import { encryptForGateway } from '../src/crypto/noise.js';
import { createEncryptFn } from '../src/crypto/index.js';
import { generateKeyPair } from '@stablelib/x25519';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('encryptForGateway', () => {
  it('output is ephemeral_pubkey (32) + ciphertext + tag (16)', async () => {
    const kp = generateKeyPair();
    const pubHex = toHex(kp.publicKey);
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

    const result = await encryptForGateway(plaintext, pubHex);

    // 32 (ephemeral pub) + 5 (plaintext) + 16 (AEAD tag)
    expect(result.length).toBe(32 + 5 + 16);
  });

  it('first 32 bytes are the ephemeral public key (not the gateway key)', async () => {
    const kp = generateKeyPair();
    const pubHex = toHex(kp.publicKey);
    const plaintext = new Uint8Array([0xaa]);

    const result = await encryptForGateway(plaintext, pubHex);

    const ephemeralPub = result.slice(0, 32);
    // Ephemeral key should NOT be the same as the gateway key
    expect(toHex(ephemeralPub)).not.toBe(pubHex);
  });

  it('produces different ciphertext each call (ephemeral key is random)', async () => {
    const kp = generateKeyPair();
    const pubHex = toHex(kp.publicKey);
    const plaintext = new Uint8Array([10, 20, 30]);

    const r1 = await encryptForGateway(plaintext, pubHex);
    const r2 = await encryptForGateway(plaintext, pubHex);

    // Different ephemeral keys → different output
    expect(toHex(r1)).not.toBe(toHex(r2));
  });

  it('rejects invalid key length', async () => {
    const shortKey = 'aabbccdd'; // only 4 bytes
    const plaintext = new Uint8Array([1]);

    await expect(encryptForGateway(plaintext, shortKey)).rejects.toThrow(
      'Expected 32-byte public key',
    );
  });

  it('accepts 0x-prefixed hex key', async () => {
    const kp = generateKeyPair();
    const pubHex = '0x' + toHex(kp.publicKey);
    const plaintext = new Uint8Array([42]);

    const result = await encryptForGateway(plaintext, pubHex);
    expect(result.length).toBe(32 + 1 + 16);
  });

  it('handles empty plaintext', async () => {
    const kp = generateKeyPair();
    const pubHex = toHex(kp.publicKey);
    const plaintext = new Uint8Array(0);

    const result = await encryptForGateway(plaintext, pubHex);
    // 32 (ephemeral) + 0 (plaintext) + 16 (tag)
    expect(result.length).toBe(32 + 0 + 16);
  });
});

describe('createEncryptFn', () => {
  it('returns the encryptForGateway function', () => {
    const fn = createEncryptFn();
    expect(fn).toBe(encryptForGateway);
  });
});
