/**
 * Binary Merkle tree over SHA-256, sorted-pair proofs (OpenZeppelin-style).
 *
 * Byte-for-byte port of `python/merkle.py`. The on-chain
 * `MerkleAnchorRegistry.verifyInclusion` mirrors the same algorithm via the
 * Solidity sha256 precompile, so a root computed here is verifiable on Arc
 * without changes.
 *
 * Design notes (same as the Python side):
 *  - Hash: SHA-256 throughout. `@noble/hashes/sha256` is the
 *    audited, dependency-free implementation we use in browsers + Node.
 *  - Pair ordering: sorted-pair concat — sha256(min(a,b) || max(a,b)). Solidity
 *    matches.
 *  - Odd levels: the lonely node is promoted (OZ-canonical), not duplicated.
 *    Simpler proofs, no second-preimage risk.
 *  - Leaves: 32 raw bytes (Uint8Array). Pass the SHA-256 of your canonical
 *    sub-part bytes.
 */

import { sha256 } from "@noble/hashes/sha2.js";

const LEAF_BYTES = 32;

function eq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b — lexicographic on bytes. */
function cmpBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** sha256 of sorted-pair concat — Solidity-compatible parent hash. */
function hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
  return cmpBytes(left, right) <= 0
    ? sha256(concat(left, right))
    : sha256(concat(right, left));
}

/** SHA-256 of arbitrary bytes — produces a 32-byte leaf. */
export function sha256Leaf(data: Uint8Array): Uint8Array {
  return sha256(data);
}

function assertLeaves(leaves: Uint8Array[]): void {
  for (const leaf of leaves) {
    if (leaf.length !== LEAF_BYTES) {
      throw new Error(`merkle: leaf must be 32 bytes, got ${leaf.length}`);
    }
  }
}

/**
 * Compute the Merkle root over a list of 32-byte leaves.
 *
 * Empty list → 32 zero bytes (sentinel; treat as "no commitment").
 * Single leaf → the leaf itself.
 */
export function merkleRoot(leaves: Uint8Array[]): Uint8Array {
  if (leaves.length === 0) return new Uint8Array(LEAF_BYTES);
  assertLeaves(leaves);
  let level = leaves.slice();
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    let i = 0;
    while (i + 1 < level.length) {
      next.push(hashPair(level[i], level[i + 1]));
      i += 2;
    }
    if (i < level.length) {
      // Lonely node promotes (OZ-canonical, NOT duplicated).
      next.push(level[i]);
    }
    level = next;
  }
  return level[0];
}

/**
 * Generate an inclusion proof for `leaves[index]`.
 *
 * Returns a list of 32-byte sibling hashes ordered bottom-up. To verify,
 * iteratively fold the leaf with each proof element via `hashPair` and
 * compare to the known root.
 */
export function merkleProof(leaves: Uint8Array[], index: number): Uint8Array[] {
  if (index < 0 || index >= leaves.length) {
    throw new RangeError(`merkle: index ${index} out of range for ${leaves.length} leaves`);
  }
  assertLeaves(leaves);
  const proof: Uint8Array[] = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    let i = 0;
    while (i + 1 < level.length) {
      const parent = hashPair(level[i], level[i + 1]);
      next.push(parent);
      if (i === idx || i + 1 === idx) {
        const sibling = i === idx ? level[i + 1] : level[i];
        proof.push(sibling);
        idx = next.length - 1;
      }
      i += 2;
    }
    if (i < level.length) {
      next.push(level[i]);
      if (i === idx) idx = next.length - 1;
    }
    level = next;
  }
  return proof;
}

/** Verify a sorted-pair Merkle proof — mirrors Solidity `verifyInclusion`. */
export function verifyProof(leaf: Uint8Array, proof: Uint8Array[], root: Uint8Array): boolean {
  if (leaf.length !== LEAF_BYTES || root.length !== LEAF_BYTES) return false;
  let h = leaf;
  for (const sibling of proof) {
    if (sibling.length !== LEAF_BYTES) return false;
    h = hashPair(h, sibling);
  }
  return eq(h, root);
}

/* ---------- hex helpers (UI convenience) ---------- */

export function bytesToHex(b: Uint8Array): string {
  let s = "0x";
  for (const v of b) s += v.toString(16).padStart(2, "0");
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  let s = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (s.length % 2 !== 0) s = "0" + s;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
