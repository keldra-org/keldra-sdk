import type { RelayStatus } from './types.js';

export type KeldraErrorCode =
  | 'HTTP'
  | 'API'
  | 'TIMEOUT'
  | 'INVALID_TRANSACTION'
  | 'CONFIG';

export class KeldraError extends Error {
  readonly code: KeldraErrorCode;
  override readonly cause?: unknown;

  constructor(code: KeldraErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'KeldraError';
    this.code = code;
    this.cause = cause;
  }

  static http(message: string, cause?: unknown): KeldraError {
    return new KeldraError('HTTP', `HTTP request failed: ${message}`, cause);
  }

  static api(status: number, message: string): KeldraApiError {
    return new KeldraApiError(status, message);
  }

  static timeout(
    relayId: string,
    lastStatus: RelayStatus,
  ): KeldraTimeoutError {
    return new KeldraTimeoutError(relayId, lastStatus);
  }

  static invalidTransaction(message: string): KeldraError {
    return new KeldraError(
      'INVALID_TRANSACTION',
      `Invalid transaction: ${message}`,
    );
  }

  static config(message: string): KeldraError {
    return new KeldraError('CONFIG', `SDK configuration error: ${message}`);
  }
}

export class KeldraApiError extends KeldraError {
  readonly status: number;

  constructor(status: number, message: string) {
    super('API', `API error (HTTP ${status}): ${message}`);
    this.name = 'KeldraApiError';
    this.status = status;
  }
}

export class KeldraTimeoutError extends KeldraError {
  readonly relayId: string;
  readonly lastStatus: RelayStatus;

  constructor(relayId: string, lastStatus: RelayStatus) {
    super(
      'TIMEOUT',
      `Relay ${relayId} timed out (last status: ${lastStatus})`,
    );
    this.name = 'KeldraTimeoutError';
    this.relayId = relayId;
    this.lastStatus = lastStatus;
  }
}
