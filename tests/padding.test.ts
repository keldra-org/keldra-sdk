import { describe, it, expect } from 'vitest';
import { padTransaction, unpadTransaction } from '../src/padding.js';

describe('padTransaction', () => {
  it('pads small tx to 512 bytes', () => {
    const tx = new Uint8Array(100);
    tx.fill(0xab);
    const padded = padTransaction(tx);
    expect(padded.length).toBe(512);
  });

  it('pads medium tx to 1024 bytes', () => {
    const tx = new Uint8Array(600);
    tx.fill(0xcd);
    const padded = padTransaction(tx);
    expect(padded.length).toBe(1024);
  });

  it('pads large tx to 2048 bytes', () => {
    const tx = new Uint8Array(1500);
    tx.fill(0xef);
    const padded = padTransaction(tx);
    expect(padded.length).toBe(2048);
  });

  it('pads to exact bucket boundary (508 bytes → 512)', () => {
    // 508 + 4 (length) = 512 exactly
    const tx = new Uint8Array(508);
    tx.fill(0x11);
    const padded = padTransaction(tx);
    expect(padded.length).toBe(512);
  });

  it('throws on oversize tx', () => {
    const tx = new Uint8Array(4093); // 4093 + 4 > 4096
    expect(() => padTransaction(tx)).toThrow('too large');
  });

  it('preserves original bytes at start', () => {
    const tx = new Uint8Array([1, 2, 3, 4, 5]);
    const padded = padTransaction(tx);
    expect(padded[0]).toBe(1);
    expect(padded[1]).toBe(2);
    expect(padded[4]).toBe(5);
  });

  it('stores length suffix as big-endian u32', () => {
    const tx = new Uint8Array(100);
    const padded = padTransaction(tx);
    const view = new DataView(padded.buffer, padded.byteOffset);
    const storedLen = view.getUint32(padded.length - 4, false);
    expect(storedLen).toBe(100);
  });
});

describe('unpadTransaction', () => {
  it('roundtrips with padTransaction', () => {
    const original = new Uint8Array([10, 20, 30, 40, 50]);
    const padded = padTransaction(original);
    const unpadded = unpadTransaction(padded);
    expect(unpadded).toEqual(original);
  });

  it('returns null for too-short input', () => {
    expect(unpadTransaction(new Uint8Array(3))).toBeNull();
  });

  it('returns null for invalid length suffix', () => {
    const bad = new Uint8Array(512);
    const view = new DataView(bad.buffer);
    view.setUint32(508, 600, false); // length > available
    expect(unpadTransaction(bad)).toBeNull();
  });
});
