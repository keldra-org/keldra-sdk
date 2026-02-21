import { encryptForGateway } from './noise.js';

export { encryptForGateway };
export type { EncryptFn } from '../types.js';

export function createEncryptFn() {
  return encryptForGateway;
}
