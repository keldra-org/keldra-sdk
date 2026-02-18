import { describe, it, expect } from 'vitest';
import { parseHex, toHex, toBase64, extractErrorMessage } from '../src/utils.js';

describe('parseHex', () => {
  it('parses hex with 0x prefix', () => {
    const bytes = parseHex('0xdeadbeef');
    expect(toHex(bytes)).toBe('deadbeef');
  });

  it('parses bare hex', () => {
    const bytes = parseHex('abcd');
    expect(bytes).toEqual(new Uint8Array([0xab, 0xcd]));
  });

  it('throws on empty', () => {
    expect(() => parseHex('')).toThrow('empty transaction');
    expect(() => parseHex('0x')).toThrow('empty transaction');
  });

  it('throws on odd-length hex', () => {
    expect(() => parseHex('0xabc')).toThrow('invalid hex');
  });

  it('throws on non-hex chars', () => {
    expect(() => parseHex('0xghij')).toThrow('invalid hex');
  });
});

describe('toHex', () => {
  it('roundtrips with parseHex', () => {
    const original = '0102030405ff';
    const bytes = parseHex(original);
    expect(toHex(bytes)).toBe(original);
  });
});

describe('toBase64', () => {
  it('encodes bytes to base64', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(toBase64(bytes)).toBe('SGVsbG8=');
  });
});

describe('extractErrorMessage', () => {
  it('extracts error field from JSON', () => {
    expect(extractErrorMessage('{"error":"rate limit exceeded"}')).toBe(
      'rate limit exceeded',
    );
  });

  it('falls back to raw string', () => {
    expect(extractErrorMessage('not json')).toBe('not json');
  });

  it('falls back if no error field', () => {
    expect(extractErrorMessage('{"message":"hi"}')).toBe('{"message":"hi"}');
  });
});
