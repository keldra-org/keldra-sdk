import type {
  Account,
  Chain as ViemChain,
  SendTransactionParameters,
  SendTransactionReturnType,
  Transport,
  WalletClient,
} from 'viem';
import type { KeldraClient } from '../client.js';
import type { Chain } from '../types.js';

export interface KeldraViemOptions {
  client: KeldraClient;
  chain: Chain;
}

/**
 * Wrap a viem WalletClient so sendTransaction routes through Keldra.
 *
 * Usage:
 * ```ts
 * import { KeldraClient } from '@keldra/sdk';
 * import { wrapWalletClient } from '@keldra/sdk/viem';
 *
 * const client = KeldraClient.create('kk_live_abc123');
 * const wrapped = wrapWalletClient(walletClient, { client, chain: 'ethereum' });
 * const hash = await wrapped.sendTransaction({ to, value });
 * // hash is the Keldra relay_id
 * ```
 */
export function wrapWalletClient<
  TTransport extends Transport = Transport,
  TChain extends ViemChain | undefined = ViemChain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  options: KeldraViemOptions,
): WalletClient<TTransport, TChain, TAccount> {
  return {
    ...walletClient,
    sendTransaction: (async (
      args: SendTransactionParameters<TChain, TAccount>,
    ): Promise<SendTransactionReturnType> => {
      // Prepare and sign the transaction without sending
      const request = await walletClient.prepareTransactionRequest(
        args as never,
      );
      const signedTx = await walletClient.signTransaction(request as never);

      // Route through Keldra
      const response = await options.client.submit(
        options.chain,
        signedTx as string,
      );
      return response.relay_id as SendTransactionReturnType;
    }) as never,
  } as WalletClient<TTransport, TChain, TAccount>;
}

/**
 * Create a custom action for viem transports that relays through Keldra.
 */
export function keldraTransportAction(options: KeldraViemOptions) {
  return {
    async sendRawTransaction({
      serializedTransaction,
    }: {
      serializedTransaction: string;
    }) {
      const response = await options.client.submit(
        options.chain,
        serializedTransaction,
      );
      return response.relay_id;
    },
  };
}
