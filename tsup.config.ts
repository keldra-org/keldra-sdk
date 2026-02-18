import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'crypto/index': 'src/crypto/index.ts',
    'ethers/index': 'src/ethers/index.ts',
    'viem/index': 'src/viem/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  external: [
    '@stablelib/x25519',
    '@stablelib/chacha20poly1305',
    '@stablelib/blake2s',
    'ethers',
    'viem',
  ],
});
