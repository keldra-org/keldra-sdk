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
  MeLimitsResponse,
  MeUsageResponse,
  NoiseKeyResponse,
  RelayRequest,
  RelayResponse,
  RelayResult,
  RelayStatusResponse,
} from './types.js';
import { TERMINAL_STATUSES } from './types.js';
import { parseHex, sleep, toBase64 } from './utils.js';

const DEFAULT_GATEWAY_URL = 'http://localhost:3400';
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MAX_POLL_INTERVAL_MS = 15_000;
const DEFAULT_API_KEY_ENV = 'KELDRA_API_KEY';
const DEFAULT_GATEWAY_ENV = 'KELDRA_GATEWAY_URL';

type EnvMap = Record<string, string | undefined>;

function isBrowserRuntime(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

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
    if (isBrowserRuntime() && config.apiKey.startsWith('kk_')) {
      throw KeldraError.config(
        'Do not use a Keldra API key in browser code. Move SDK calls to your backend.',
      );
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

  static create(apiKey: string): KeldraClient {
    return new KeldraClient({ apiKey });
  }

  static fromEnv(
    env: EnvMap = ((globalThis as { process?: { env?: EnvMap } }).process?.env ??
      {}) as EnvMap,
    options?: {
      apiKeyEnv?: string;
      gatewayUrlEnv?: string;
    },
  ): KeldraClient {
    if (isBrowserRuntime()) {
      throw KeldraError.config(
        'KeldraClient.fromEnv() is server-only. Load KELDRA_API_KEY on your backend.',
      );
    }
    const apiKeyName = options?.apiKeyEnv ?? DEFAULT_API_KEY_ENV;
    const gatewayUrlName = options?.gatewayUrlEnv ?? DEFAULT_GATEWAY_ENV;
    const apiKey = env[apiKeyName];

    if (!apiKey) {
      throw KeldraError.config(`${apiKeyName} is required`);
    }

    return new KeldraClient({
      apiKey,
      gatewayUrl: env[gatewayUrlName] ?? DEFAULT_GATEWAY_URL,
    });
  }

  static builder(): KeldraClientBuilder {
    return new KeldraClientBuilder();
  }

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

  async submit(chain: Chain, signedTx: string): Promise<RelayResponse> {
    const rawBytes = parseHex(signedTx);
    if (!(this.noisePublicKey && this.noiseKid && this.encryptFn)) {
      throw KeldraError.config(
        'Encryption is required. Configure .withEncryption(createEncryptFn()) and call fetchNoiseKey() before submit().',
      );
    }

    const padded = padTransaction(rawBytes);
    const encrypted = await this.encryptFn(padded, this.noisePublicKey);
    const b64 = toBase64(encrypted);
    const request: RelayRequest = {
      chain,
      signed_tx: '',
      options: { delay_profile: this.defaultDelayProfile },
      encrypted_payload: b64,
      noise_kid: this.noiseKid,
    };

    return this.http.post<RelayResponse>(
      `${this.gatewayUrl}/v1/relay`,
      request,
    );
  }

  async status(relayId: string): Promise<RelayStatusResponse> {
    return this.http.get<RelayStatusResponse>(
      `${this.gatewayUrl}/v1/relay/${relayId}/status`,
    );
  }

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
      } catch {}

      interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
    }

    throw KeldraError.timeout(relayId, lastStatus?.status ?? 'queued');
  }

  async health(): Promise<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.gatewayUrl}/v1/health`);
  }

  async chains(): Promise<ChainsResponse> {
    return this.http.get<ChainsResponse>(`${this.gatewayUrl}/v1/chains`);
  }

  async limits(): Promise<MeLimitsResponse> {
    return this.http.get<MeLimitsResponse>(`${this.gatewayUrl}/v1/me/limits`);
  }

  async usage(from: string, to: string): Promise<MeUsageResponse> {
    const params = new URLSearchParams({ from, to });
    return this.http.get<MeUsageResponse>(
      `${this.gatewayUrl}/v1/me/usage?${params.toString()}`,
    );
  }

  async fetchNoiseKey(): Promise<void> {
    const resp = await this.http.get<NoiseKeyResponse>(
      `${this.gatewayUrl}/v1/noise-key`,
    );
    this.noisePublicKey = resp.public_key;
    this.noiseKid = resp.kid;
  }

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
