# arc-merkle-anchor

> **Anchor any artifact on Arc with a Merkle root. Prove inclusion of any
> sub-part with a ~96-byte proof. ~$0.001 USDC per anchor.**

A starter kit for Arc builders who need **verifiable-data infrastructure** —
the missing companion to Arc's payment-flow reference repos (`arc-commerce`,
`arc-p2p-payments`, `arc-escrow`).

You commit a tuple — `(artifactId, contentHash, merkleRoot, schemaVersion, contentCid)` —
to an append-only on-chain registry. Anyone holding the root from the event
log can later prove that one specific sub-part — one evidence URL, one log
line, one inference step — was part of the original commitment, by
submitting a small inclusion proof. **No full-payload download, no trust in
the publisher.**

The on-chain verifier is a single pure function:

```solidity
function verifyInclusion(bytes32 root, bytes32 leaf, bytes32[] calldata proof)
    external pure returns (bool);
```

That's the wedge. Forks can specialize the artifact-id schema and the CID
format to their domain; the Merkle machinery doesn't care what the leaves
mean.

---

## Live on Arc Testnet

| | |
|---|---|
| **Contract** | [`0x707B2243583CC6A9bda9AF5EAF02720042917769`](https://testnet.arcscan.app/address/0x707B2243583CC6A9bda9AF5EAF02720042917769) (source-verified) |
| **Chain** | Arc Testnet · chain id `5042002` |
| **Example anchor** | [`0x88e1e93041adb63be315f63afa3928a19d1cd0cf848719f5bb165d7f182703a1`](https://testnet.arcscan.app/tx/0x88e1e93041adb63be315f63afa3928a19d1cd0cf848719f5bb165d7f182703a1) |
| **Measured per-anchor cost** | **50,793 gas · 21 gwei · ~$0.0010667 USDC** |
| **Proof size (5-leaf tree)** | 3 siblings × 32 bytes = **96 bytes** |

The single anchor above committed a 5-sub-part artifact and proved sub-part
`#2` on-chain via `verifyInclusion` (eth_call). Reproduce with the
`python/anchor_example.py` walkthrough below.

---

## Why anchor instead of just storing the hash?

A naive design stores just `sha256(artifact)` on-chain. That proves the whole
artifact existed at time `t` — useful, but anyone wanting to check a single
piece of it has to download the full blob and rehash.

A Merkle root commits to the full artifact **and** every sub-part
independently. Now:

- A 1-MB evidence pack becomes a 32-byte root on-chain.
- Any single source URL inside it can be proven with ~96 bytes regardless of
  artifact size.
- The proof is cryptographic — nobody can fake "yes, this URL was in there"
  without breaking SHA-256.
- The on-chain verifier is a pure function: smart contracts on the same chain
  can gate logic on inclusion proofs ("only pay out if this evidence was
  anchored before block X").

Examples of artifacts this fits:

- **AI inference traces** — prove a specific source/citation was used.
- **Audit logs** — prove a specific event was in the log without revealing
  others.
- **Document bundles** — notarize a packet, later prove one page.
- **Code review snapshots** — prove a specific file hash was in a release.

---

## Quickstart (5 min)

```bash
git clone https://github.com/tang-vu/arc-merkle-anchor.git
cd arc-merkle-anchor

# 1. Install foundry deps (forge-std only — the contract has zero imports).
forge install foundry-rs/forge-std

# 2. Build + test offline (13 tests, all green).
forge build
forge test

# 3. Configure your Arc RPC + deployer key.
cp .env.example .env
# edit .env: paste RPC + DEPLOYER_PRIVATE_KEY
# (Canteen CLI: arc-canteen rpc-url --export)

# 4. Deploy to Arc testnet.
source .env
forge script script/Deploy.s.sol \
    --rpc-url "$RPC" \
    --broadcast \
    --private-key "$DEPLOYER_PRIVATE_KEY"
# → MerkleAnchorRegistry deployed at 0x...
# Copy that address into .env as MERKLE_ANCHOR_ADDRESS.

# 5. (optional) Source-verify on Arcscan.
forge verify-contract \
    --rpc-url "$RPC" \
    --verifier blockscout \
    --verifier-url https://testnet.arcscan.app/api \
    "$MERKLE_ANCHOR_ADDRESS" src/MerkleAnchorRegistry.sol:MerkleAnchorRegistry

# 6. Run the end-to-end Python example (anchor + prove).
cd python
pip install -r requirements.txt
python anchor_example.py
```

You'll see real on-chain tx hashes, a 96-byte proof printed, and **both**
the off-chain (Python) and on-chain (eth_call) verifiers returning `true`.

---

## Repository layout

```
arc-merkle-anchor/
├── src/MerkleAnchorRegistry.sol     ← the contract (zero imports)
├── script/Deploy.s.sol              ← Foundry deploy script
├── test/MerkleAnchorRegistry.t.sol  ← 13 tests, covers verifier + tampering
├── foundry.toml                     ← solc 0.8.26, via_ir
├── python/
│   ├── merkle.py                    ← off-chain prover (pure stdlib)
│   ├── anchor_example.py            ← end-to-end demo
│   └── requirements.txt             ← web3 + dotenv only (for the example)
└── frontend/                        ← Next.js 15 + wagmi v2 + viem v2 + ConnectKit starter
    └── README.md                    ← drag a file → browser-side Merkle → wallet signs → on-chain anchor
```

**Zero-import contract:** `src/MerkleAnchorRegistry.sol` imports nothing.
Solidity 0.8.26 only. Copy the file into your project, no OpenZeppelin
dependency, no remappings.

**Zero-dep prover:** `python/merkle.py` uses only `hashlib` from the standard
library. The example script needs `web3` to talk to Arc, but the prover
itself is portable to any environment.

**Frontend starter (`frontend/`):** Next.js 15 + wagmi v2 + viem v2 +
ConnectKit. Anchor / verify / session-key flows on top of the deployed
registry. Browser-side SHA-256 + Merkle root — nothing leaves the device
until the user signs. Static-export-friendly; one env var (`NEXT_PUBLIC_REGISTRY_ADDRESS`)
points it at your own deployed registry. See `frontend/README.md` for the
5-minute quick start.

---

## Contract reference

### `anchor(artifactId, contentHash, merkleRoot, schemaVersion, contentCid) → id`

Anchor a single artifact. Emits `Anchored(id, publisher, artifactId, contentHash, merkleRoot, schemaVersion, contentCid, anchoredAt)`.
Returns the monotonic anchor ID.

- `artifactId` — caller-defined `bytes32`. Stable identifier for the artifact
  (a URL hash, a UUID, a domain-specific key).
- `contentHash` — `sha256` of the full artifact's canonical bytes. Must be
  non-zero.
- `merkleRoot` — `sha256` Merkle root over the artifact's sub-part hashes,
  sorted-pair convention. Must be non-zero.
- `schemaVersion` — `bytes16`, ASCII-packed. Lets you evolve the artifact
  schema without breaking historical anchors.
- `contentCid` — string pointer to the full artifact (IPFS, Irys, Arweave,
  S3, anything content-addressed). Must be non-empty.

### `anchorBatch(artifactIds[], contentHashes[], merkleRoots[], schemaVersions[], contentCids[]) → (firstId, lastId)`

Batch variant — same validation, one transaction, gas-amortized.

### `verifyInclusion(root, leaf, proof) → bool`

Pure function. Folds `leaf` upward through `proof` using the same sorted-pair
SHA-256 step as the prover. Returns true iff the final hash equals `root`.

- ~60 gas per proof level (Ethereum `sha256` precompile).
- Cheap enough to call from another contract — gate behaviour on
  "evidence X was anchored" without trusting an oracle.

---

## Hash + Merkle conventions

- **Hash:** SHA-256 everywhere. Solidity uses the precompile (~60 gas);
  Python uses `hashlib`. They produce byte-identical roots, so off-chain
  proofs verify on-chain (covered by the test suite + the example script).
- **Pair ordering:** sorted-pair concat — `sha256(min(a,b) || max(a,b))`.
  OpenZeppelin's MerkleProof convention with `keccak256` swapped for
  `sha256`. Proofs are direction-free; you don't have to track left/right.
- **Odd levels:** the lonely node is **promoted**, not duplicated. This
  matches OZ-canonical behaviour and removes the second-preimage attack
  surface of naïve duplication.
- **Leaves:** 32 raw bytes (the SHA-256 of each sub-part's canonical bytes).

If you change the hash function, the ordering, or the odd-level behaviour,
the on-chain and off-chain implementations will silently disagree. Don't.
Or — if you do — change both in lockstep.

---

## Forking the contract

The reference contract is intentionally generic. To specialize for your
domain:

1. **Rename the event fields.** The contract emits opaque `bytes32`/`string`
   payloads; you decide what `artifactId` and `contentCid` mean. If you want
   typed fields (e.g. a `uint32 marketId` for a prediction-market oracle,
   or a `address signer` for a notary), add them as additional `event`
   parameters and the matching `anchor*` arguments.
2. **Keep `verifyInclusion` intact.** It's the only function that has a
   cross-language contract with the Python prover. Touch it and you'll need
   to mirror the change in `python/merkle.py`.
3. **Solidity 0.8.26 + `via_ir = true`** in `foundry.toml`. The contract
   compiles cleanly at that pragma and Arc supports it.

---

## License

MIT. Fork it, ship it, send a PR if you make it better.

---

## Acknowledgements

Born out of the [Agora Agents Hackathon](https://agora.thecanteenapp.com)
(Canteen × Circle, May 11–25, 2026) as the on-chain commitment layer behind
[ReasoningReceipt](https://github.com/tang-vu/reasoning-receipt) — an
x402-paywalled AI oracle whose reasoning traces are anchored as Merkle DAGs.
The contract here is the generalized, application-free version of that
primitive, packaged so other Arc builders can drop it in without inheriting
the oracle domain.
