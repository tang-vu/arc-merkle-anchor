# arc-merkle-anchor — frontend starter kit

> **A Next.js + wagmi + viem + ConnectKit starter on top of the
> `MerkleAnchorRegistry` contract.** Drag a file in, see its SHA-256 + Merkle
> root computed in your browser, sign + anchor on Arc Testnet. Verify any
> inclusion proof with a free `eth_call`. Optional session-key flow for
> batched/streamed anchoring.

Built per aadi's 2026-05-24 hint for "React/Next + wagmi/viem frontends that
wire x402 (client side) + session keys on top of the ArcOSS primitives".
Fork-and-deploy: one env var points the UI at your own deployed registry.

---

## Quick start

```bash
cd frontend
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Connect any browser wallet (MetaMask, Rabby,
Frame, Coinbase Wallet …). The UI ships pointed at the public Arc Testnet
deployment of `MerkleAnchorRegistry` —
[`0x707B2243583CC6A9bda9AF5EAF02720042917769`](https://testnet.arcscan.app/address/0x707B2243583CC6A9bda9AF5EAF02720042917769) —
so anchor and verify work end-to-end without any extra setup.

Need testnet USDC for gas? Use the Canteen / Arc faucet (see the parent
project's `.env.example`).

---

## What's inside

| Route | What it does |
|---|---|
| `/` | Landing page, "Connect" button, your recent anchors (read straight from the contract event log) |
| `/anchor` | File dropzone → browser-side SHA-256 + Merkle root → wallet signs → `anchor(...)` lands on Arc |
| `/verify` | Paste a root, a leaf, and a proof — on-chain `verifyInclusion` via `eth_call` + a local recompute side-by-side |
| `/session-keys` | Generate an ephemeral key in your browser; sign a delegation envelope with your main wallet for batched anchoring |

### `src/lib/`

- **`merkle-client.ts`** — byte-for-byte port of `python/merkle.py`. Sorted-pair SHA-256 (OZ-canonical, lonely-node promote). Exposed: `merkleRoot`, `merkleProof`, `verifyProof`, `sha256Leaf`, `bytesToHex`, `hexToBytes`.
- **`chunk.ts`** — `chunkFile(file, chunkSize=65536)` → `{ contentHash, leaves, chunks }`. Defaults to 64 KiB chunks; pick anything you want.
- **`registry-abi.ts`** — minimal ABI extract + default contract address + default `bytes16` schema (`anchor/1`). Override with `NEXT_PUBLIC_REGISTRY_ADDRESS` to point at your own registry.
- **`wagmi-config.ts`** — Arc Testnet `defineChain` + ConnectKit's `getDefaultConfig`. Override RPC with `NEXT_PUBLIC_RPC_URL`.
- **`session-key.ts`** — generate / persist / wipe a secp256k1 key in `localStorage`; build a human-readable delegation envelope for the main wallet to sign.

### `src/components/`

`anchor-form.tsx`, `inclusion-verifier.tsx`, `anchors-list.tsx`,
`session-key-manager.tsx`, `connect-button.tsx`, `providers.tsx`. Each one is
short — read them.

---

## Environment

All variables are optional. Defaults work against the live Arc Testnet deployment.

```env
# Optional — point the UI at YOUR deployed registry.
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...

# Optional — custom Arc RPC.
NEXT_PUBLIC_RPC_URL=https://rpc-testnet.arc.network

# Optional — enables the WalletConnect connector in ConnectKit.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

---

## Forking checklist

You want to lift this kit on top of *your* contract on Arc:

1. Deploy your `MerkleAnchorRegistry` (or a fork) — see the parent repo's
   `script/Deploy.s.sol`.
2. Copy `frontend/` into your own repo.
3. Edit `src/lib/registry-abi.ts` if your fork added fields to `Anchored`.
4. Set `NEXT_PUBLIC_REGISTRY_ADDRESS` in `.env.local`.
5. `pnpm install && pnpm build` → static export ready for any host (Vercel,
   Cloudflare Pages, GH Pages, Netlify…).

---

## Session-key scope (read this before relying on it)

The MVP records the delegation **off-chain** — the localStorage key is a real
secp256k1 signer, but the on-chain registry still attributes the publisher to
whichever EOA signs the transaction. A future contract extension can pick up
the signed envelope and treat anchors-by-delegate as anchors-by-delegator;
that contract change is out of scope for the starter.

If you need on-chain delegated anchoring today, mount the registry behind an
ERC-4337 smart account and add the session key as a signer module.

---

## License

MIT — same as the parent repo.
