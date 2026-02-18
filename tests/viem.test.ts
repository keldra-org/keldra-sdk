import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  wrapWalletClient,
  keldraTransportAction,
} from '../src/viem/index.js';

describe('wrapWalletClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('overrides sendTransaction to route through Keldra', async () => {
    const fakeWallet = {
      prepareTransactionRequest: vi.fn(async (args: unknown) => args),
      signTransaction: vi.fn(async () => '0xsignedtx'),
      getAddresses: vi.fn(async () => ['0x1234']),
    };

    const client = {
      submit: vi.fn(async () => ({
        relay_id: 'viem-relay-1',
        estimated_broadcast_min_secs: 5,
        estimated_broadcast_max_secs: 15,
      })),
    };

    const wrapped = wrapWalletClient(fakeWallet as never, {
      client: client as never,
      chain: 'ethereum',
    });

    const result = await (wrapped as any).sendTransaction({
      to: '0xabc',
      value: 100n,
    });

    expect(fakeWallet.prepareTransactionRequest).toHaveBeenCalledOnce();
    expect(fakeWallet.signTransaction).toHaveBeenCalledOnce();
    expect(client.submit).toHaveBeenCalledWith('ethereum', '0xsignedtx');
    expect(result).toBe('viem-relay-1');
  });

  it('preserves other wallet methods', () => {
    const fakeWallet = {
      getAddresses: vi.fn(async () => ['0x1234']),
      sendTransaction: vi.fn(),
    };

    const wrapped = wrapWalletClient(fakeWallet as never, {
      client: {} as never,
      chain: 'ethereum',
    });

    // getAddresses should be the same reference
    expect((wrapped as any).getAddresses).toBe(fakeWallet.getAddresses);
  });
});

describe('keldraTransportAction', () => {
  it('sendRawTransaction submits through Keldra', async () => {
    const client = {
      submit: vi.fn(async () => ({
        relay_id: 'transport-relay',
        estimated_broadcast_min_secs: 1,
        estimated_broadcast_max_secs: 5,
      })),
    };

    const action = keldraTransportAction({
      client: client as never,
      chain: 'polygon',
    });

    const result = await action.sendRawTransaction({
      serializedTransaction: '0xdeadbeef',
    });

    expect(client.submit).toHaveBeenCalledWith('polygon', '0xdeadbeef');
    expect(result).toBe('transport-relay');
  });
});
