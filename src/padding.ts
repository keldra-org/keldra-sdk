const BUCKETS = [512, 1024, 2048, 4096] as const;

/**
 * Pad a raw transaction to a fixed size bucket.
 * Format: [original_tx] [random_padding] [4-byte big-endian original length]
 *
 * Must produce byte-compatible output with the Rust SDK padding.
 */
export function padTransaction(rawTx: Uint8Array): Uint8Array {
  const originalLen = rawTx.length;
  const totalNeeded = originalLen + 4; // 4 bytes for length suffix

  const bucket = BUCKETS.find((b) => b >= totalNeeded);
  if (!bucket) {
    throw new Error(
      `Transaction too large: ${originalLen} bytes (max ${BUCKETS[BUCKETS.length - 1] - 4} bytes)`,
    );
  }

  const padded = new Uint8Array(bucket);
  padded.set(rawTx, 0);

  // Fill random padding bytes
  const paddingLen = bucket - totalNeeded;
  if (paddingLen > 0) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(paddingLen));
    padded.set(randomBytes, originalLen);
  }

  // 4-byte big-endian original length suffix
  const view = new DataView(padded.buffer, padded.byteOffset);
  view.setUint32(bucket - 4, originalLen, false); // big-endian

  return padded;
}

/**
 * Unpad a padded transaction, extracting the original bytes.
 * Returns null if the input is invalid.
 */
export function unpadTransaction(padded: Uint8Array): Uint8Array | null {
  if (padded.length < 4) return null;
  const view = new DataView(padded.buffer, padded.byteOffset);
  const originalLen = view.getUint32(padded.length - 4, false);
  if (originalLen > padded.length - 4) return null;
  return padded.slice(0, originalLen);
}
