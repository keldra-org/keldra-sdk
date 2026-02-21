const BUCKETS = [512, 1024, 2048, 4096] as const;

export function padTransaction(rawTx: Uint8Array): Uint8Array {
  const originalLen = rawTx.length;
  const totalNeeded = originalLen + 4;

  const bucket = BUCKETS.find((b) => b >= totalNeeded);
  if (!bucket) {
    throw new Error(
      `Transaction too large: ${originalLen} bytes (max ${BUCKETS[BUCKETS.length - 1] - 4} bytes)`,
    );
  }

  const padded = new Uint8Array(bucket);
  padded.set(rawTx, 0);

  const paddingLen = bucket - totalNeeded;
  if (paddingLen > 0) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(paddingLen));
    padded.set(randomBytes, originalLen);
  }

  const view = new DataView(padded.buffer, padded.byteOffset);
  view.setUint32(bucket - 4, originalLen, false);

  return padded;
}

export function unpadTransaction(padded: Uint8Array): Uint8Array | null {
  if (padded.length < 4) return null;
  const view = new DataView(padded.buffer, padded.byteOffset);
  const originalLen = view.getUint32(padded.length - 4, false);
  if (originalLen > padded.length - 4) return null;
  return padded.slice(0, originalLen);
}
