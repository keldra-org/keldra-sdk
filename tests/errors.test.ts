import { describe, it, expect } from 'vitest';
import {
  KeldraError,
  KeldraApiError,
  KeldraTimeoutError,
} from '../src/errors.js';

describe('KeldraError', () => {
  it('http factory', () => {
    const err = KeldraError.http('network down');
    expect(err.code).toBe('HTTP');
    expect(err.message).toBe('HTTP request failed: network down');
    expect(err).toBeInstanceOf(KeldraError);
  });

  it('api factory', () => {
    const err = KeldraError.api(429, 'rate limit exceeded');
    expect(err.code).toBe('API');
    expect(err.status).toBe(429);
    expect(err.message).toBe('API error (HTTP 429): rate limit exceeded');
    expect(err).toBeInstanceOf(KeldraError);
    expect(err).toBeInstanceOf(KeldraApiError);
  });

  it('timeout factory', () => {
    const err = KeldraError.timeout('abc-123', 'injected');
    expect(err.code).toBe('TIMEOUT');
    expect(err.relayId).toBe('abc-123');
    expect(err.lastStatus).toBe('injected');
    expect(err.message).toBe(
      'Relay abc-123 timed out (last status: injected)',
    );
    expect(err).toBeInstanceOf(KeldraError);
    expect(err).toBeInstanceOf(KeldraTimeoutError);
  });

  it('invalidTransaction factory', () => {
    const err = KeldraError.invalidTransaction('empty transaction');
    expect(err.code).toBe('INVALID_TRANSACTION');
    expect(err.message).toBe('Invalid transaction: empty transaction');
  });

  it('config factory', () => {
    const err = KeldraError.config('apiKey is required');
    expect(err.code).toBe('CONFIG');
    expect(err.message).toBe('SDK configuration error: apiKey is required');
  });

  it('preserves cause', () => {
    const cause = new Error('original');
    const err = KeldraError.http('failed', cause);
    expect(err.cause).toBe(cause);
  });
});
