import { KeldraError } from './errors.js';
import { HttpClient } from './http.js';
import { padTransaction } from './padding.js';
import type {
  Chain,
  ChainsResponse,
  DelayProfile,
  EncryptFn,
  HealthResponse,
  KeldraClientConfig,
  NoiseKeyResponse,
  RelayRequest,
  RelayResponse,
  RelayResult,
  RelayStatusResponse,
} from './types.js';
import { TERMINAL_STATUSES } from './types.js';
import { parseHex, sleep, toBase64, toHex } from './utils.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3400';
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const DEFAULT_POLL_INTERVAL_MS = 2_000; // 2 seconds
const MAX_POLL_INTERVAL_MS = 15_000; // 15 second cap

export class KeldraClient {
  private readonly http: HttpClient;
  private readonly gatewayUrl: string;
  private readonly defaultDelayProfile: DelayProfile;
  private readonly confirmationTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private noisePublicKey?: string;
  private noiseKid?: string;
  private readonly encryptFn?: EncryptFn;

  constructor(config: KeldraClientConfig) {
    if (!config.apiKey) {
      throw KeldraError.config('apiKey is required');
    }
    this.http = new HttpClient(config.apiKey);
    this.gatewayUrl = (config.gatewayUrl ?? DEFAULT_GATEWAY_URL).replace(
      /\/$/,
      '',
    );
    this.defaultDelayProfile = config.delayProfile ?? 'balanced';
    this.confirmationTimeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.pollIntervalMs = config.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.noisePublicKey = config.noisePublicKey;
    this.noiseKid = config.noiseKid;
    this.encryptFn = config.encryptFn;
  }

  /** Create a client with just an API key (uses defaults). */
  static create(apiKey: string): KeldraClient {
    return new KeldraClient({ apiKey });
  }

  /** Create a builder for advanced configuration. */
  static builder(): KeldraClientBuilder {
    return new KeldraClientBuilder();
  }

  /** Submit a transaction and wait for confirmation. */
  async relay(chain: Chain, signedTx: string): Promise<RelayResult> {
    const start = Date.now();
    const response = await this.submit(chain, signedTx);
    const result = await this.waitForConfirmation(response.relay_id);
    return {
      relayId: response.relay_id,
      status: result.status,
      txHash: result.tx_hash,
      durationMs: Date.now() - start,
      error: result.error,
    };
  }

  /** Submit a transaction without waiting. Returns relay_id for polling. */
  async submit(chain: Chain, signedTx: string): Promise<RelayResponse> {
    const rawBytes = parseHex(signedTx);
    const padded = padTransaction(rawBytes);

    let request: RelayRequest;
    if (this.noisePublicKey && this.noiseKid && this.encryptFn) {
      const encrypted = await this.encryptFn(padded, this.noisePublicKey);
      const b64 = toBase64(encrypted);
      request = {
        chain,
        signed_tx: '',
        options: { delay_profile: this.defaultDelayProfile },
        encrypted_payload: b64,
        noise_kid: this.noiseKid,
      };
    } else {
      request = {
        chain,
        signed_tx: `0x${toHex(padded)}`,
        options: { delay_profile: this.defaultDelayProfile },
      };
    }

    return this.http.post<RelayResponse>(
      `${this.gatewayUrl}/v1/relay`,
      request,
    );
  }

  /** Check relay status once. */
  async status(relayId: string): Promise<RelayStatusResponse> {
    return this.http.get<RelayStatusResponse>(
      `${this.gatewayUrl}/v1/relay/${relayId}/status`,
    );
  }

  /** Poll until confirmed or failed, with exponential backoff. */
  async waitForConfirmation(relayId: string): Promise<RelayStatusResponse> {
    const deadline = Date.now() + this.confirmationTimeoutMs;
    let interval = this.pollIntervalMs;
    let lastStatus: RelayStatusResponse | undefined;

    while (Date.now() < deadline) {
      await sleep(interval);

      try {
        lastStatus = await this.status(relayId);
        if (TERMINAL_STATUSES.has(lastStatus.status)) {
          return lastStatus;
        }
      } catch {
        // Swallow poll errors and retry (matches Rust behavior)
      }

      interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
    }

    throw KeldraError.timeout(relayId, lastStatus?.status ?? 'queued');
  }

  /** GET /v1/health */
  async health(): Promise<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.gatewayUrl}/v1/health`);
  }

  /** GET /v1/chains */
  async chains(): Promise<ChainsResponse> {
    return this.http.get<ChainsResponse>(`${this.gatewayUrl}/v1/chains`);
  }

  /** Fetch the gateway's Noise public key and enable encryption. */
  async fetchNoiseKey(): Promise<void> {
    const resp = await this.http.get<NoiseKeyResponse>(
      `${this.gatewayUrl}/v1/noise-key`,
    );
    this.noisePublicKey = resp.public_key;
    this.noiseKid = resp.kid;
  }

  /** Whether encryption is currently enabled. */
  get encrypted(): boolean {
    return !!(this.noisePublicKey && this.noiseKid && this.encryptFn);
  }
}

export class KeldraClientBuilder {
  private config: Partial<KeldraClientConfig> = {};

  apiKey(key: string): this {
    this.config.apiKey = key;
    return this;
  }

  gatewayUrl(url: string): this {
    this.config.gatewayUrl = url;
    return this;
  }

  delayProfile(profile: DelayProfile): this {
    this.config.delayProfile = profile;
    return this;
  }

  timeout(ms: number): this {
    this.config.timeoutMs = ms;
    return this;
  }

  pollInterval(ms: number): this {
    this.config.pollIntervalMs = ms;
    return this;
  }

  noisePublicKey(key: string, kid: string): this {
    this.config.noisePublicKey = key;
    this.config.noiseKid = kid;
    return this;
  }

  withEncryption(fn: EncryptFn): this {
    this.config.encryptFn = fn;
    return this;
  }

  build(): KeldraClient {
    if (!this.config.apiKey) {
      throw KeldraError.config('apiKey is required');
    }
    return new KeldraClient(this.config as KeldraClientConfig);
  }
}
