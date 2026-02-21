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
      const request = await walletClient.prepareTransactionRequest(
        args as never,
      );
      const signedTx = await walletClient.signTransaction(request as never);

      const response = await options.client.submit(
        options.chain,
        signedTx as string,
      );
      return response.relay_id as SendTransactionReturnType;
    }) as never,
  } as WalletClient<TTransport, TChain, TAccount>;
}

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
