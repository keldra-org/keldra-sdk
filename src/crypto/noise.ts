import { generateKeyPair, sharedKey } from '@stablelib/x25519';
import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305';
import { hash as blake2sHash } from '@stablelib/blake2s';

const PROTOCOL_NAME = 'Noise_NK_25519_ChaChaPoly_BLAKE2s';
const HASHLEN = 32;

export async function encryptForGateway(
  plaintext: Uint8Array,
  gatewayPublicKeyHex: string,
): Promise<Uint8Array> {
  const rs = hexToBytes(gatewayPublicKeyHex);
  if (rs.length !== 32) {
    throw new Error(`Expected 32-byte public key, got ${rs.length} bytes`);
  }

  const protocolBytes = new TextEncoder().encode(PROTOCOL_NAME);
  let h: Uint8Array;
  if (protocolBytes.length <= HASHLEN) {
    h = new Uint8Array(HASHLEN);
    h.set(protocolBytes);
  } else {
    h = blake2sHash(protocolBytes, HASHLEN);
  }

  let ck = new Uint8Array(h);
  h = blake2sHash(concat(h, new Uint8Array(0)), HASHLEN);
  h = blake2sHash(concat(h, rs), HASHLEN);

  const ephemeral = generateKeyPair();
  const ePub = ephemeral.publicKey;
  h = blake2sHash(concat(h, ePub), HASHLEN);

  const dhResult = sharedKey(ephemeral.secretKey, rs);
  const hkdfResult = hkdf(ck, dhResult, 2);
  ck = new Uint8Array(hkdfResult[0]);
  const k = new Uint8Array(hkdfResult[1]);

  const nonce = nonceBytes(0n);
  const aead = new ChaCha20Poly1305(k);
  const ciphertext = aead.seal(nonce, plaintext, h);

  return concat(ePub, ciphertext);
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16);
  }
  return bytes;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function hkdf(
  chainingKey: Uint8Array,
  inputKeyMaterial: Uint8Array,
  numOutputs: number,
): Uint8Array[] {
  const tempKey = hmacBlake2s(chainingKey, inputKeyMaterial);
  const outputs: Uint8Array[] = [];
  let prev: Uint8Array = new Uint8Array(0);

  for (let i = 1; i <= numOutputs; i++) {
    const input = concat(prev, new Uint8Array([i]));
    prev = new Uint8Array(hmacBlake2s(tempKey, input));
    outputs.push(prev);
  }

  return outputs;
}

function hmacBlake2s(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  let paddedKey: Uint8Array;

  if (key.length > blockSize) {
    paddedKey = new Uint8Array(blockSize);
    paddedKey.set(blake2sHash(key, HASHLEN));
  } else {
    paddedKey = new Uint8Array(blockSize);
    paddedKey.set(key);
  }

  const iPad = new Uint8Array(blockSize);
  const oPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    iPad[i] = paddedKey[i] ^ 0x36;
    oPad[i] = paddedKey[i] ^ 0x5c;
  }

  const inner = blake2sHash(concat(iPad, data), HASHLEN);
  return blake2sHash(concat(oPad, inner), HASHLEN);
}

function nonceBytes(n: bigint): Uint8Array {
  const nonce = new Uint8Array(12);
  const view = new DataView(nonce.buffer);
  view.setUint32(4, Number(n & 0xffffffffn), true);
  view.setUint32(8, Number((n >> 32n) & 0xffffffffn), true);
  return nonce;
}
