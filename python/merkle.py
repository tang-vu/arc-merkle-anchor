"""Binary Merkle tree over SHA-256, sorted-pair proofs (OpenZeppelin-style).

This is the off-chain prover that mirrors `MerkleAnchorRegistry.verifyInclusion`
byte-for-byte. Use it to:

  1. Compute the Merkle root over your artifact's sub-part hashes.
  2. Pass that root to the `anchor(...)` call on-chain.
  3. Later, generate a ~200-byte inclusion proof for any single sub-part.
  4. Anyone — including a smart contract — can then verify that sub-part was
     part of the original commitment, without downloading the full artifact.

Design notes:
- **Hash function:** SHA-256 throughout. Solidity has a `sha256` precompile
  (~60 gas), so the verifier is cheap. Pure Python stdlib (`hashlib`) — no
  third-party dependencies.
- **Pair ordering:** sorted-pair concat (`sha256(min(a,b) || max(a,b))`).
  Matches OpenZeppelin's MerkleProof.sol convention except `keccak256` is
  swapped for `sha256`. Algorithm is otherwise identical.
- **Odd levels:** the lonely node is promoted, not duplicated. OZ-canonical;
  simpler proof generation, no second-preimage attack surface.
- **Leaf format:** 32 raw bytes. Callers pass `bytes` leaves that are the
  SHA-256 of the canonical bytes of each sub-part.
"""

from __future__ import annotations

import hashlib


def _h(left: bytes, right: bytes) -> bytes:
    """SHA-256 of sorted-pair concat — Solidity-compatible parent hash."""
    if left <= right:
        return hashlib.sha256(left + right).digest()
    return hashlib.sha256(right + left).digest()


def merkle_root(leaves: list[bytes]) -> bytes:
    """Compute the Merkle root over a list of 32-byte leaves.

    Empty list → 32 zero bytes (sentinel; treat as "no commitment").
    Single leaf → the leaf itself is the root.
    """
    if not leaves:
        return b"\x00" * 32
    for leaf in leaves:
        if len(leaf) != 32:
            raise ValueError(f"merkle: leaf must be 32 bytes, got {len(leaf)}")
    level = list(leaves)
    while len(level) > 1:
        next_level: list[bytes] = []
        i = 0
        while i + 1 < len(level):
            next_level.append(_h(level[i], level[i + 1]))
            i += 2
        if i < len(level):
            # Lonely node at the end: promote up (OZ-canonical).
            next_level.append(level[i])
        level = next_level
    return level[0]


def merkle_proof(leaves: list[bytes], index: int) -> list[bytes]:
    """Generate an inclusion proof for `leaves[index]`.

    Returns a list of 32-byte sibling hashes. To verify, iteratively fold the
    leaf with each proof element using `_h` and check the final hash equals
    the known root. Order is bottom-up (leaf level first, root level last).
    """
    if index < 0 or index >= len(leaves):
        raise IndexError(f"merkle: index {index} out of range for {len(leaves)} leaves")
    proof: list[bytes] = []
    level = list(leaves)
    idx = index
    while len(level) > 1:
        next_level: list[bytes] = []
        i = 0
        while i + 1 < len(level):
            pair_parent = _h(level[i], level[i + 1])
            next_level.append(pair_parent)
            if i == idx or i + 1 == idx:
                sibling = level[i + 1] if i == idx else level[i]
                proof.append(sibling)
                idx = len(next_level) - 1
            i += 2
        if i < len(level):
            # Lonely node — promote; no sibling added to the proof.
            next_level.append(level[i])
            if i == idx:
                idx = len(next_level) - 1
        level = next_level
    return proof


def verify_proof(leaf: bytes, proof: list[bytes], root: bytes) -> bool:
    """Verify a sorted-pair Merkle proof. Mirrors Solidity `verifyInclusion`."""
    if len(leaf) != 32 or len(root) != 32:
        return False
    h = leaf
    for sibling in proof:
        if len(sibling) != 32:
            return False
        h = _h(h, sibling)
    return h == root


def sha256_leaf(data: bytes) -> bytes:
    """Convenience: SHA-256 of arbitrary bytes — produces a 32-byte leaf."""
    return hashlib.sha256(data).digest()


if __name__ == "__main__":
    # Quick self-test: build a tree, prove every leaf, verify.
    parts = [f"sub-part-{i}".encode() for i in range(7)]
    leaves = [sha256_leaf(p) for p in parts]
    root = merkle_root(leaves)
    print(f"root: 0x{root.hex()}")
    for i, leaf in enumerate(leaves):
        proof = merkle_proof(leaves, i)
        assert verify_proof(leaf, proof, root), f"leaf {i} failed to verify"
        print(f"  leaf {i}: proof size={len(proof)} bytes={len(proof) * 32}  ok")
    print("all proofs verified")
