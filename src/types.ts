// Chain names (matches Rust Chain enum serde rename_all = "snake_case")
export type Chain = 'ethereum' | 'arbitrum' | 'optimism' | 'base' | 'polygon';

// Delay profiles (matches Rust DelayProfile serde rename_all = "snake_case")
export type DelayProfile = 'fast' | 'balanced' | 'maximum_privacy';

// Relay statuses (matches Rust RelayStatus serde rename_all = "snake_case")
export type RelayStatus = 'queued' | 'batched' | 'injected' | 'confirmed' | 'failed';

export const TERMINAL_STATUSES: ReadonlySet<RelayStatus> = new Set([
  'confirmed',
  'failed',
]);

// POST /v1/relay request body
export interface RelayRequest {
  chain: Chain;
  signed_tx: string;
  options: RelayOptions;
  encrypted_payload?: string;
  noise_kid?: string;
}

export interface RelayOptions {
  delay_profile: DelayProfile;
}

// POST /v1/relay response
export interface RelayResponse {
  relay_id: string;
  estimated_broadcast_min_secs: number;
  estimated_broadcast_max_secs: number;
}

// GET /v1/relay/:id/status response
export interface RelayStatusResponse {
  relay_id: string;
  status: RelayStatus;
  queued_at: string;
  batched_at?: string;
  injected_at?: string;
  confirmed_at?: string;
  tx_hash?: string;
  error?: string;
}

// SDK-level result (mirrors Rust RelayResult)
export interface RelayResult {
  relayId: string;
  status: RelayStatus;
  txHash?: string;
  durationMs: number;
  error?: string;
}

// GET /v1/health response
export interface HealthResponse {
  status: string;
  gateway_regions: string[];
  injection_regions: string[];
  supported_chains: string[];
  stats: HealthStats;
}

export interface HealthStats {
  active_relays: number;
  total_relays: number;
  queued: number;
  batched: number;
  injected: number;
  confirmed: number;
  failed: number;
}

// GET /v1/chains response
export interface ChainsResponse {
  chains: ChainConfig[];
}

export interface ChainConfig {
  chain: Chain;
  name: string;
  min_batch_size: number;
  epoch_duration_secs: number;
  injection_node_count: number;
  confirmation_timeout_secs: number;
  enabled: boolean;
}

// GET /v1/noise-key response
export interface NoiseKeyResponse {
  kid: string;
  public_key: string;
  protocol: string;
}

// Encryption function signature for optional injection
export type EncryptFn = (
  plaintext: Uint8Array,
  gatewayPublicKeyHex: string,
) => Promise<Uint8Array>;

// Client configuration
export interface KeldraClientConfig {
  apiKey: string;
  gatewayUrl?: string;
  delayProfile?: DelayProfile;
  timeoutMs?: number;
  pollIntervalMs?: number;
  noisePublicKey?: string;
  noiseKid?: string;
  encryptFn?: EncryptFn;
}
