import { generateKeyPair, sharedKey } from '@stablelib/x25519';
import { ChaCha20Poly1305 } from '@stablelib/chacha20poly1305';
import { hash as blake2sHash } from '@stablelib/blake2s';

// Noise protocol name — must match Rust gateway exactly
const PROTOCOL_NAME = 'Noise_NK_25519_ChaChaPoly_BLAKE2s';

// BLAKE2s hash length
const HASHLEN = 32;
// ChaChaPoly1305 key length
const KEYLEN = 32;
// AEAD tag length
const TAGLEN = 16;

/**
 * Encrypt plaintext for a Keldra gateway using Noise-NK one-shot handshake.
 *
 * Protocol: Noise_NK_25519_ChaChaPoly_BLAKE2s
 * Pattern NK:
 *   <- s           (pre-message: responder's static key is known)
 *   -> e, es       (initiator sends ephemeral, does DH)
 *
 * Output: ephemeral_pubkey (32) || ciphertext || tag (16)
 *
 * Must be byte-compatible with the Rust `snow` crate.
 */
export async function encryptForGateway(
  plaintext: Uint8Array,
  gatewayPublicKeyHex: string,
): Promise<Uint8Array> {
  const rs = hexToBytes(gatewayPublicKeyHex);
  if (rs.length !== 32) {
    throw new Error(
      `Expected 32-byte public key, got ${rs.length} bytes`,
    );
  }

  // Initialize symmetric state per Noise spec section 5
  // h = HASH(protocol_name padded to HASHLEN or HASH(protocol_name) if longer)
  const protocolBytes = new TextEncoder().encode(PROTOCOL_NAME);
  let h: Uint8Array;
  if (protocolBytes.length <= HASHLEN) {
    h = new Uint8Array(HASHLEN);
    h.set(protocolBytes);
  } else {
    h = blake2sHash(protocolBytes, HASHLEN);
  }

  // ck = h (initial chaining key)
  let ck = new Uint8Array(h);

  // MixHash(prologue) — prologue is empty
  h = blake2sHash(concat(h, new Uint8Array(0)), HASHLEN);

  // Pre-message: MixHash(rs) — responder's static key
  h = blake2sHash(concat(h, rs), HASHLEN);

  // -> e: generate ephemeral keypair
  const ephemeral = generateKeyPair();
  const ePub = ephemeral.publicKey;

  // MixHash(e.public_key)
  h = blake2sHash(concat(h, ePub), HASHLEN);

  // -> es: MixKey(DH(e, rs))
  const dhResult = sharedKey(ephemeral.secretKey, rs);
  const hkdfResult = hkdf(ck, dhResult, 2);
  ck = new Uint8Array(hkdfResult[0]);
  const k = new Uint8Array(hkdfResult[1]);
  let n = 0n; // nonce counter

  // EncryptAndHash(plaintext)
  const nonce = nonceBytes(n);
  const aead = new ChaCha20Poly1305(k);
  const ciphertext = aead.seal(nonce, plaintext, h);

  // MixHash(ciphertext) — not strictly needed since we're done, but for correctness
  // h = blake2sHash(concat(h, ciphertext), HASHLEN);

  // Output: e.public || ciphertext (includes tag)
  return concat(ePub, ciphertext);
}

// ── Helpers ────────────────────────────────────────────────────────────

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

/**
 * HKDF using BLAKE2s as the hash function.
 * Noise spec section 4.3: HKDF(chaining_key, input_key_material, num_outputs)
 */
function hkdf(
  chainingKey: Uint8Array,
  inputKeyMaterial: Uint8Array,
  numOutputs: number,
): Uint8Array[] {
  // Extract: temp_key = HMAC-BLAKE2s(chaining_key, input_key_material)
  const tempKey = hmacBlake2s(chainingKey, inputKeyMaterial);

  // Expand
  const outputs: Uint8Array[] = [];
  let prev: Uint8Array = new Uint8Array(0);

  for (let i = 1; i <= numOutputs; i++) {
    const input = concat(prev, new Uint8Array([i]));
    prev = new Uint8Array(hmacBlake2s(tempKey, input));
    outputs.push(prev);
  }

  return outputs;
}

/**
 * HMAC-BLAKE2s(key, data)
 * HMAC construction: H((key XOR opad) || H((key XOR ipad) || data))
 */
function hmacBlake2s(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64; // BLAKE2s block size
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

/**
 * Convert a 64-bit nonce counter to a 12-byte nonce for ChaChaPoly.
 * Noise spec: 4 zero bytes || 8-byte little-endian counter
 */
function nonceBytes(n: bigint): Uint8Array {
  const nonce = new Uint8Array(12);
  const view = new DataView(nonce.buffer);
  // 4 zero bytes (already zero), then 8-byte LE counter
  view.setUint32(4, Number(n & 0xffffffffn), true);
  view.setUint32(8, Number((n >> 32n) & 0xffffffffn), true);
  return nonce;
}
