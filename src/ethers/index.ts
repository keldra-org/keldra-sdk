import type { Signer, TransactionRequest } from 'ethers';
import type { KeldraClient } from '../client.js';
import type { Chain, RelayResponse } from '../types.js';

export interface KeldraBroadcasterOptions {
  client: KeldraClient;
  chain: Chain;
  waitForConfirmation?: boolean;
}

/**
 * Wrap an ethers.js v6 Signer so that sendTransaction routes through Keldra.
 *
 * Usage:
 * ```ts
 * import { KeldraClient } from '@keldra/sdk';
 * import { wrapSigner } from '@keldra/sdk/ethers';
 *
 * const client = KeldraClient.create('kk_live_abc123');
 * const wrapped = wrapSigner(signer, { client, chain: 'ethereum' });
 * const tx = await wrapped.sendTransaction({ to, value });
 * // tx.hash is the Keldra relay_id
 * ```
 */
export function wrapSigner(
  signer: Signer,
  options: KeldraBroadcasterOptions,
): Signer {
  return new Proxy(signer, {
    get(target, prop, receiver) {
      if (prop === 'sendTransaction') {
        return async (tx: TransactionRequest) => {
          // Sign the transaction without broadcasting
          const populated = await target.populateTransaction(tx);
          const signedTx = await target.signTransaction(populated);

          // Submit through Keldra
          const relayResponse = await options.client.submit(
            options.chain,
            signedTx,
          );

          if (options.waitForConfirmation) {
            const result = await options.client.waitForConfirmation(
              relayResponse.relay_id,
            );
            return {
              ...relayResponse,
              hash: result.tx_hash ?? relayResponse.relay_id,
            };
          }

          return {
            ...relayResponse,
            hash: relayResponse.relay_id,
          };
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Lower-level broadcaster for direct use.
 */
export class KeldraBroadcaster {
  constructor(
    private readonly client: KeldraClient,
    private readonly chain: Chain,
  ) {}

  async broadcastTransaction(signedTx: string): Promise<RelayResponse> {
    return this.client.submit(this.chain, signedTx);
  }
}
