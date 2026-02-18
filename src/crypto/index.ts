import { encryptForGateway } from './noise.js';

export { encryptForGateway };
export type { EncryptFn } from '../types.js';

/**
 * Create an EncryptFn that can be passed to the KeldraClient builder.
 *
 * Usage:
 * ```ts
 * import { KeldraClient } from '@keldra/sdk';
 * import { createEncryptFn } from '@keldra/sdk/crypto';
 *
 * const client = KeldraClient.builder()
 *   .apiKey('kk_live_abc123')
 *   .withEncryption(createEncryptFn())
 *   .build();
 *
 * await client.fetchNoiseKey();
 * // All subsequent submissions are encrypted
 * ```
 */
export function createEncryptFn() {
  return encryptForGateway;
}
