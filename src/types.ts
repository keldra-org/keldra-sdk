export type Chain = 'ethereum' | 'arbitrum' | 'optimism' | 'base' | 'polygon';

export type DelayProfile = 'fast' | 'balanced' | 'maximum_privacy';

export type RelayStatus = 'queued' | 'batched' | 'injected' | 'confirmed' | 'failed';

export const TERMINAL_STATUSES: ReadonlySet<RelayStatus> = new Set([
  'confirmed',
  'failed',
]);

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

export interface RelayResponse {
  relay_id: string;
  estimated_broadcast_min_secs: number;
  estimated_broadcast_max_secs: number;
}

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

export interface RelayResult {
  relayId: string;
  status: RelayStatus;
  txHash?: string;
  durationMs: number;
  error?: string;
}

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

export interface NoiseKeyResponse {
  kid: string;
  public_key: string;
  protocol: string;
}

export interface MeLimitsResponse {
  api_key: string;
  key_id: string;
  tier: string;
  limits: EffectiveLimits;
  usage: CurrentUsage;
}

export interface EffectiveLimits {
  requests_per_minute: number;
  max_inflight: number;
  monthly_quota_relays: number;
  min_poll_interval_ms: number;
  max_body_bytes: number;
}

export interface CurrentUsage {
  month: string;
  monthly_relays_submitted: number;
  monthly_remaining_relays: number;
  inflight_relays: number;
}

export interface MeUsageResponse {
  daily: UsageDailyRow[];
  totals: UsageTotals;
}

export interface UsageDailyRow {
  day: string;
  api_key: string;
  tier: string;
  relays_submitted: number;
  relays_confirmed: number;
  relays_failed: number;
  bytes_ingested: number;
}

export interface UsageTotals {
  relays_submitted: number;
  relays_confirmed: number;
  relays_failed: number;
  bytes_ingested: number;
}

export type EncryptFn = (
  plaintext: Uint8Array,
  gatewayPublicKeyHex: string,
) => Promise<Uint8Array>;

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
