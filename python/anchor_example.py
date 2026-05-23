"""End-to-end example: anchor an artifact on Arc and prove inclusion of a sub-part.

Walks through the four steps a fork-it builder will follow:

  1. Take an artifact (here: a JSON document with N sub-parts).
  2. SHA-256 each sub-part to get leaves; compute the Merkle root.
  3. Call `anchor(...)` on the deployed MerkleAnchorRegistry — emits an event
     carrying (artifactId, contentHash, merkleRoot, schemaVersion, contentCid).
  4. Later: pick any sub-part, generate a ~200-byte proof, verify against the
     root read from the event log.

Run:

    cd python
    pip install -r requirements.txt    # web3, eth-account, python-dotenv
    python anchor_example.py

Env vars (loaded from ../.env if present):
    RPC                       Arc testnet JSON-RPC URL.
    DEPLOYER_PRIVATE_KEY      Funded EOA. The publisher.
    MERKLE_ANCHOR_ADDRESS     Deployed contract address.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path

from merkle import merkle_proof, merkle_root, sha256_leaf, verify_proof

try:
    from dotenv import load_dotenv
    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware  # type: ignore
except ImportError:
    print("missing deps. run: pip install web3 eth-account python-dotenv", file=sys.stderr)
    sys.exit(1)


REGISTRY_ABI = [
    {
        "type": "function",
        "name": "anchor",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "artifactId", "type": "bytes32"},
            {"name": "contentHash", "type": "bytes32"},
            {"name": "merkleRoot", "type": "bytes32"},
            {"name": "schemaVersion", "type": "bytes16"},
            {"name": "contentCid", "type": "string"},
        ],
        "outputs": [{"name": "id", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "verifyInclusion",
        "stateMutability": "pure",
        "inputs": [
            {"name": "root", "type": "bytes32"},
            {"name": "leaf", "type": "bytes32"},
            {"name": "proof", "type": "bytes32[]"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "type": "event",
        "name": "Anchored",
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "id", "type": "uint256"},
            {"indexed": True, "name": "publisher", "type": "address"},
            {"indexed": True, "name": "artifactId", "type": "bytes32"},
            {"indexed": False, "name": "contentHash", "type": "bytes32"},
            {"indexed": False, "name": "merkleRoot", "type": "bytes32"},
            {"indexed": False, "name": "schemaVersion", "type": "bytes16"},
            {"indexed": False, "name": "contentCid", "type": "string"},
            {"indexed": False, "name": "anchoredAt", "type": "uint64"},
        ],
    },
]


def canonical_bytes(obj: object) -> bytes:
    """Deterministic JSON bytes: sorted keys, UTF-8, no whitespace gaps.

    The same bytes must produce the same hash on any machine. Use this — or
    your own canonical encoder — for every sub-part *and* the full artifact
    before hashing.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")

    rpc = os.environ.get("RPC")
    pk = os.environ.get("DEPLOYER_PRIVATE_KEY")
    addr = os.environ.get("MERKLE_ANCHOR_ADDRESS")
    if not (rpc and pk and addr):
        print("set RPC, DEPLOYER_PRIVATE_KEY, MERKLE_ANCHOR_ADDRESS in .env", file=sys.stderr)
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(rpc))
    # Arc emits an extraData blob slightly larger than what web3.py's default
    # validator allows; install the POA middleware so block lookups succeed.
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        print(f"could not connect to RPC: {rpc}", file=sys.stderr)
        sys.exit(1)

    acct = w3.eth.account.from_key(pk)
    registry = w3.eth.contract(address=Web3.to_checksum_address(addr), abi=REGISTRY_ABI)

    # ---------- 1. The artifact ----------
    artifact = {
        "title": "Quarterly evidence packet",
        "sub_parts": [
            {"id": 0, "url": "https://example.com/source-a", "claim": "alpha"},
            {"id": 1, "url": "https://example.com/source-b", "claim": "beta"},
            {"id": 2, "url": "https://example.com/source-c", "claim": "gamma"},
            {"id": 3, "url": "https://example.com/source-d", "claim": "delta"},
            {"id": 4, "url": "https://example.com/source-e", "claim": "epsilon"},
        ],
    }

    # ---------- 2. Hash sub-parts + compute root ----------
    sub_parts = artifact["sub_parts"]
    leaves = [sha256_leaf(canonical_bytes(p)) for p in sub_parts]
    root = merkle_root(leaves)
    full_hash = hashlib.sha256(canonical_bytes(artifact)).digest()

    # Caller-defined stable id. Could be a UUID, a URL hash, anything 32-byte.
    artifact_id = hashlib.sha256(b"example.com/quarterly-evidence/2026-q1").digest()

    print(f"artifact_id : 0x{artifact_id.hex()}")
    print(f"content_hash: 0x{full_hash.hex()}")
    print(f"merkle_root : 0x{root.hex()}")

    # ---------- 3. Anchor on-chain ----------
    schema = b"anchor/1".ljust(16, b"\x00")
    cid = "ipfs://QmExampleCidReplaceMeWithRealUpload"

    tx = registry.functions.anchor(artifact_id, full_hash, root, schema, cid).build_transaction(
        {
            "from": acct.address,
            "nonce": w3.eth.get_transaction_count(acct.address),
            "chainId": w3.eth.chain_id,
            "gas": 250_000,
            # Arc accepts EIP-1559; leave maxFeePerGas at the chain default.
            "maxFeePerGas": w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
        }
    )
    signed = acct.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    print(f"\nanchored. tx={tx_hash.hex()} block={receipt.blockNumber}")

    anchored = registry.events.Anchored().process_receipt(receipt)[0]
    on_chain_root = anchored["args"]["merkleRoot"]
    assert on_chain_root == root, "off-chain root mismatch — bug"

    # ---------- 4. Prove a single sub-part ----------
    target_index = 2
    target_leaf = leaves[target_index]
    proof = merkle_proof(leaves, target_index)
    proof_bytes = sum(len(p) for p in proof)
    print(f"\nproof for sub_part[{target_index}] ({sub_parts[target_index]['claim']!r}):")
    print(f"  proof depth: {len(proof)}")
    print(f"  proof size : {proof_bytes} bytes")
    for i, sibling in enumerate(proof):
        print(f"    [{i}] 0x{sibling.hex()}")

    # Verify off-chain.
    ok_off = verify_proof(target_leaf, proof, root)
    print(f"\noff-chain verify: {ok_off}")

    # Verify on-chain (eth_call — no gas spent).
    ok_on = registry.functions.verifyInclusion(root, target_leaf, proof).call()
    print(f"on-chain verify : {ok_on}")
    assert ok_off and ok_on, "verification disagreement — bug"
    print("\ndone.")


if __name__ == "__main__":
    main()
