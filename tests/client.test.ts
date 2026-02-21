import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeldraClient, KeldraClientBuilder } from '../src/client.js';
import { KeldraError, KeldraApiError, KeldraTimeoutError } from '../src/errors.js';
import { mockFetch } from './helpers/mock-fetch.js';

describe('KeldraClientBuilder', () => {
  it('throws if apiKey is missing', () => {
    expect(() => KeldraClient.builder().build()).toThrow(
      'apiKey is required',
    );
  });

  it('builds with defaults', () => {
    const client = KeldraClient.builder().apiKey('kk_test').build();
    expect(client).toBeInstanceOf(KeldraClient);
    expect(client.encrypted).toBe(false);
  });

  it('chains all builder methods', () => {
    const client = KeldraClient.builder()
      .apiKey('kk_test')
      .gatewayUrl('https://example.com')
      .delayProfile('fast')
      .timeout(60_000)
      .pollInterval(1_000)
      .noisePublicKey('aabb', 'kid1')
      .build();
    expect(client).toBeInstanceOf(KeldraClient);
  });
});

describe('KeldraClient.create', () => {
  it('creates a client with just apiKey', () => {
    const client = KeldraClient.create('kk_test');
    expect(client).toBeInstanceOf(KeldraClient);
  });
});

describe('KeldraClient.submit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends correct JSON to /v1/relay', async () => {
    const mock = mockFetch([
      {
        body: {
          relay_id: 'test-uuid',
          estimated_broadcast_min_secs: 5.0,
          estimated_broadcast_max_secs: 15.0,
        },
      },
    ]);

    const client = KeldraClient.create('kk_test');
    const resp = await client.submit('ethereum', '0xdeadbeef');

    expect(resp.relay_id).toBe('test-uuid');
    expect(mock).toHaveBeenCalledTimes(1);

    const [url, init] = mock.mock.calls[0];
    expect(url).toBe('http://localhost:3400/v1/relay');
    expect(init?.method).toBe('POST');

    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer kk_test');

    const body = JSON.parse(init?.body as string);
    expect(body.chain).toBe('ethereum');
    expect(body.signed_tx).toMatch(/^0x/);
    expect(body.options.delay_profile).toBe('balanced');
  });

  it('pads the transaction', async () => {
    mockFetch([{ body: { relay_id: 'x', estimated_broadcast_min_secs: 0, estimated_broadcast_max_secs: 0 } }]);

    const client = KeldraClient.create('kk_test');
    await client.submit('ethereum', '0xab');

    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string,
    );
    // 1 byte tx → padded to 512 bytes → 1024 hex chars + "0x"
    expect(body.signed_tx.length).toBe(2 + 512 * 2);
  });
});

describe('KeldraClient.status', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls correct URL', async () => {
    const mock = mockFetch([
      {
        body: {
          relay_id: 'abc',
          status: 'queued',
          queued_at: '2025-01-01T00:00:00Z',
        },
      },
    ]);

    const client = KeldraClient.create('kk_test');
    const resp = await client.status('abc');

    expect(resp.status).toBe('queued');
    expect(mock.mock.calls[0][0]).toBe(
      'http://localhost:3400/v1/relay/abc/status',
    );
  });
});

describe('KeldraClient.health', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses health response', async () => {
    mockFetch([
      {
        body: {
          status: 'ok',
          gateway_regions: ['us-east'],
          injection_regions: ['us-east'],
          supported_chains: ['ethereum'],
          stats: { active_relays: 0, total_relays: 0, queued: 0, batched: 0, injected: 0, confirmed: 0, failed: 0 },
        },
      },
    ]);

    const client = KeldraClient.create('kk_test');
    const resp = await client.health();
    expect(resp.status).toBe('ok');
    expect(resp.supported_chains).toContain('ethereum');
  });
});

describe('KeldraClient.chains', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses chains response', async () => {
    mockFetch([
      {
        body: {
          chains: [
            { chain: 'ethereum', name: 'Ethereum', min_batch_size: 3, epoch_duration_secs: 10, injection_node_count: 1, confirmation_timeout_secs: 300, enabled: true },
          ],
        },
      },
    ]);

    const client = KeldraClient.create('kk_test');
    const resp = await client.chains();
    expect(resp.chains).toHaveLength(1);
    expect(resp.chains[0].chain).toBe('ethereum');
  });
});

describe('KeldraClient.limits', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses /v1/me/limits response', async () => {
    mockFetch([
      {
        body: {
          api_key: 'kk_test',
          key_id: 'k_123',
          tier: 'pro',
          limits: {
            requests_per_minute: 120,
            max_inflight: 200,
            monthly_quota_relays: 2_000_000,
            min_poll_interval_ms: 500,
            max_body_bytes: 16384,
          },
          usage: {
            month: '2026-02',
            monthly_relays_submitted: 1234,
            monthly_remaining_relays: 1_998_766,
            inflight_relays: 0,
          },
        },
      },
    ]);

    const client = KeldraClient.create('kk_test');
    const resp = await client.limits();
    expect(resp.tier).toBe('pro');
    expect(resp.limits.requests_per_minute).toBe(120);
    expect(resp.usage.monthly_relays_submitted).toBe(1234);
  });
});

describe('KeldraClient.usage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses /v1/me/usage response', async () => {
    const mock = mockFetch([
      {
        body: {
          daily: [
            {
              day: '2026-02-20',
              api_key: 'kk_test',
              tier: 'pro',
              relays_submitted: 40,
              relays_confirmed: 39,
              relays_failed: 1,
              bytes_ingested: 10000,
            },
          ],
          totals: {
            relays_submitted: 40,
            relays_confirmed: 39,
            relays_failed: 1,
            bytes_ingested: 10000,
          },
        },
      },
    ]);

    const client = KeldraClient.create('kk_test');
    const resp = await client.usage('2026-02-01', '2026-02-20');
    expect(resp.daily).toHaveLength(1);
    expect(resp.totals.relays_submitted).toBe(40);
    expect(mock.mock.calls[0][0]).toBe(
      'http://localhost:3400/v1/me/usage?from=2026-02-01&to=2026-02-20',
    );
  });
});

describe('KeldraClient.waitForConfirmation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns on confirmed status', async () => {
    mockFetch([
      { body: { relay_id: 'x', status: 'queued', queued_at: '' } },
      { body: { relay_id: 'x', status: 'confirmed', queued_at: '', tx_hash: '0xabc' } },
    ]);

    const client = KeldraClient.builder()
      .apiKey('kk_test')
      .pollInterval(10)
      .build();

    const resp = await client.waitForConfirmation('x');
    expect(resp.status).toBe('confirmed');
    expect(resp.tx_hash).toBe('0xabc');
  });

  it('returns on failed status', async () => {
    mockFetch([
      { body: { relay_id: 'x', status: 'failed', queued_at: '', error: 'rpc error' } },
    ]);

    const client = KeldraClient.builder()
      .apiKey('kk_test')
      .pollInterval(10)
      .build();

    const resp = await client.waitForConfirmation('x');
    expect(resp.status).toBe('failed');
    expect(resp.error).toBe('rpc error');
  });

  it('throws timeout after deadline', async () => {
    // Always return queued
    mockFetch([
      { body: { relay_id: 'x', status: 'queued', queued_at: '' } },
    ]);

    const client = KeldraClient.builder()
      .apiKey('kk_test')
      .timeout(50) // 50ms timeout
      .pollInterval(10)
      .build();

    await expect(client.waitForConfirmation('x')).rejects.toThrow(
      KeldraTimeoutError,
    );
  });
});

describe('API errors', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws KeldraApiError on non-2xx response', async () => {
    mockFetch([
      { status: 401, body: { error: 'invalid API key' } },
    ]);

    const client = KeldraClient.create('kk_bad');
    await expect(client.health()).rejects.toThrow(KeldraApiError);

    try {
      await client.health();
    } catch (e) {
      expect(e).toBeInstanceOf(KeldraApiError);
      expect((e as KeldraApiError).status).toBe(401);
    }
  });
});
