# @keldra/sdk

TypeScript SDK for the Keldra relay API.

## Security

- Use this SDK with a server-side API key only.
- Never ship `kk_...` keys in browser/client bundles.
- Keep `KELDRA_API_KEY` in backend environment variables.

## Install

```bash
npm install @keldra/sdk
```

If you want encrypted payload transport:

```bash
npm install @keldra/sdk @stablelib/x25519 @stablelib/chacha20poly1305 @stablelib/blake2s
```

If you want framework adapters:

```bash
npm install @keldra/sdk ethers
npm install @keldra/sdk viem
```

## Quick Start

```ts
import { KeldraClient } from "@keldra/sdk";

const client = KeldraClient.fromEnv();
const result = await client.relay("ethereum", signedTxHex);
const limits = await client.limits();
const usage = await client.usage("2026-02-01", "2026-02-20");

console.log(result.relayId, result.status, result.txHash);
console.log(limits.tier, usage.totals.relays_submitted);
```

## API Key From .env

Use environment variables on your backend:

```env
KELDRA_API_KEY=kk_your_api_key
KELDRA_GATEWAY_URL=https://relay.keldra.io
```

Then initialize directly:

```ts
import { KeldraClient } from "@keldra/sdk";

const client = KeldraClient.fromEnv();
```

## Backend Proxy Example (Next.js)

Keep Keldra calls on your server route:

```ts
// app/api/relay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { KeldraClient } from "@keldra/sdk";

const client = KeldraClient.fromEnv();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { chain, signedTx } = body as { chain: "ethereum"; signedTx: string };

  if (!chain || !signedTx) {
    return NextResponse.json({ error: "chain and signedTx are required" }, { status: 400 });
  }

  const relay = await client.relay(chain, signedTx);
  return NextResponse.json(relay);
}
```

Frontend calls your backend endpoint, not Keldra directly.

## Encrypted Transport

```ts
import { KeldraClient } from "@keldra/sdk";
import { createEncryptFn } from "@keldra/sdk/crypto";

const client = KeldraClient.builder()
  .apiKey("kk_your_api_key")
  .withEncryption(createEncryptFn())
  .build();

await client.fetchNoiseKey();
const relay = await client.submit("ethereum", signedTxHex);
```

## Ethers Integration

```ts
import { KeldraClient } from "@keldra/sdk";
import { wrapSigner } from "@keldra/sdk/ethers";

const client = KeldraClient.create("kk_your_api_key");
const signer = wrapSigner(originalSigner, { client, chain: "ethereum" });

const tx = await signer.sendTransaction({ to, value });
console.log(tx.hash);
```

## Viem Integration

```ts
import { KeldraClient } from "@keldra/sdk";
import { wrapWalletClient } from "@keldra/sdk/viem";

const client = KeldraClient.create("kk_your_api_key");
const walletClient = wrapWalletClient(originalWalletClient, { client, chain: "ethereum" });

const relayId = await walletClient.sendTransaction({ to, value });
console.log(relayId);
```

## Exports

- `@keldra/sdk` core client, types, errors
- `@keldra/sdk/crypto` optional encryption helper
- `@keldra/sdk/ethers` ethers wrapper
- `@keldra/sdk/viem` viem wrapper

## Requirements

- Node.js 18+
- API key from Keldra

## License

MIT
