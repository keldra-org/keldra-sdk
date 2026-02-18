import { describe, it, expect, vi, afterEach } from 'vitest';
import { wrapSigner, KeldraBroadcaster } from '../src/ethers/index.js';
import { mockFetch } from './helpers/mock-fetch.js';

describe('wrapSigner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('intercepts sendTransaction and routes through Keldra', async () => {
    mockFetch([
      {
        body: {
          relay_id: 'relay-123',
          estimated_broadcast_min_secs: 5,
          estimated_broadcast_max_secs: 15,
        },
      },
    ]);

    const fakeSigner = {
      populateTransaction: vi.fn(async (tx: unknown) => tx),
      signTransaction: vi.fn(async () => '0xdeadbeef'),
      getAddress: vi.fn(async () => '0x1234'),
    };

    const client = {
      submit: vi.fn(async () => ({
        relay_id: 'relay-123',
        estimated_broadcast_min_secs: 5,
        estimated_broadcast_max_secs: 15,
      })),
      waitForConfirmation: vi.fn(),
    };

    const wrapped = wrapSigner(fakeSigner as never, {
      client: client as never,
      chain: 'ethereum',
    });

    const result: any = await (wrapped as any).sendTransaction({
      to: '0xabc',
      value: 100n,
    });

    expect(fakeSigner.populateTransaction).toHaveBeenCalledOnce();
    expect(fakeSigner.signTransaction).toHaveBeenCalledOnce();
    expect(client.submit).toHaveBeenCalledWith('ethereum', '0xdeadbeef');
    expect(result.relay_id).toBe('relay-123');
    expect(result.hash).toBe('relay-123');
  });

  it('passes through non-sendTransaction methods', () => {
    const fakeSigner = {
      getAddress: vi.fn(async () => '0x1234'),
    };

    const wrapped = wrapSigner(fakeSigner as never, {
      client: {} as never,
      chain: 'ethereum',
    });

    expect((wrapped as any).getAddress).toBe(fakeSigner.getAddress);
  });

  it('waits for confirmation when option is set', async () => {
    const client = {
      submit: vi.fn(async () => ({
        relay_id: 'relay-456',
        estimated_broadcast_min_secs: 5,
        estimated_broadcast_max_secs: 15,
      })),
      waitForConfirmation: vi.fn(async () => ({
        relay_id: 'relay-456',
        status: 'confirmed',
        tx_hash: '0xfinalhash',
      })),
    };

    const fakeSigner = {
      populateTransaction: vi.fn(async (tx: unknown) => tx),
      signTransaction: vi.fn(async () => '0xaabb'),
    };

    const wrapped = wrapSigner(fakeSigner as never, {
      client: client as never,
      chain: 'ethereum',
      waitForConfirmation: true,
    });

    const result: any = await (wrapped as any).sendTransaction({ to: '0x1' });

    expect(client.waitForConfirmation).toHaveBeenCalledWith('relay-456');
    expect(result.hash).toBe('0xfinalhash');
  });
});

describe('KeldraBroadcaster', () => {
  it('broadcastTransaction calls client.submit', async () => {
    const client = {
      submit: vi.fn(async () => ({
        relay_id: 'bc-relay',
        estimated_broadcast_min_secs: 1,
        estimated_broadcast_max_secs: 5,
      })),
    };

    const broadcaster = new KeldraBroadcaster(client as never, 'ethereum');
    const result = await broadcaster.broadcastTransaction('0xdeadbeef');

    expect(client.submit).toHaveBeenCalledWith('ethereum', '0xdeadbeef');
    expect(result.relay_id).toBe('bc-relay');
  });
});
