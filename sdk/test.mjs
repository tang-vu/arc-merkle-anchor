import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProofBundle,
  bytesToHex,
  hexToBytes,
  merkleProof,
  merkleRoot,
  sha256Leaf,
  verifyProof,
  verifyProofBundle,
} from "./index.mjs";

const encoder = new TextEncoder();

const EXPECTED = {
  leaves: [
    "0x282bcbc3f0a34a8a4ac6f00c276fcf66cf3757a3332e83d92208e5079af46922",
    "0x823412d1eacb67956220e532959f0104603057c88704863ca38e7cd188fda812",
    "0x25a63e52a98f6fdaa6187da559a0a3a55d845d0322ca183ad6ad5e006c4ed646",
  ],
  root: "0x213b6c533a527d345a4166b89e8e2fa41788f11c3c99b383d0d8c5dfc83164dc",
  proofForPolicy: [
    "0x282bcbc3f0a34a8a4ac6f00c276fcf66cf3757a3332e83d92208e5079af46922",
    "0x25a63e52a98f6fdaa6187da559a0a3a55d845d0322ca183ad6ad5e006c4ed646",
  ],
};

test("matches the Python/Solidity compatibility vector", async () => {
  const parts = ["intent", "policy", "outcome"].map((value) => encoder.encode(value));
  const leaves = await Promise.all(parts.map(sha256Leaf));
  assert.deepEqual(leaves.map(bytesToHex), EXPECTED.leaves);

  const root = await merkleRoot(leaves);
  assert.equal(bytesToHex(root), EXPECTED.root);

  const proof = await merkleProof(leaves, 1);
  assert.deepEqual(proof.map(bytesToHex), EXPECTED.proofForPolicy);
  assert.equal(await verifyProof(leaves[1], proof, root), true);
});

test("portable proof bundles verify and reject tampering", async () => {
  const parts = ["intent", "policy", "outcome"].map((value) => encoder.encode(value));
  const bundle = await buildProofBundle(parts, 1);
  assert.equal(await verifyProofBundle(bundle), true);

  const tampered = { ...bundle, leaf: bytesToHex(hexToBytes(EXPECTED.leaves[0])) };
  assert.equal(await verifyProofBundle(tampered), false);
});
