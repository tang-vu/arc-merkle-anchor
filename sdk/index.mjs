const LEAF_BYTES = 32;

function assertBytes32(value, label = "value") {
  if (!(value instanceof Uint8Array) || value.length !== LEAF_BYTES) {
    throw new TypeError(`${label} must be a 32-byte Uint8Array`);
  }
}

function compareBytes(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function concatBytes(a, b) {
  const output = new Uint8Array(a.length + b.length);
  output.set(a, 0);
  output.set(b, a.length);
  return output;
}

async function digest(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this runtime");
  }
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

async function hashPair(left, right) {
  assertBytes32(left, "left");
  assertBytes32(right, "right");
  return compareBytes(left, right) <= 0
    ? digest(concatBytes(left, right))
    : digest(concatBytes(right, left));
}

export async function sha256Leaf(data) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError("data must be a Uint8Array");
  }
  return digest(data);
}

export async function merkleRoot(leaves) {
  if (!Array.isArray(leaves)) throw new TypeError("leaves must be an array");
  if (leaves.length === 0) return new Uint8Array(LEAF_BYTES);
  for (const leaf of leaves) assertBytes32(leaf, "leaf");

  let level = leaves.map((leaf) => leaf.slice());
  while (level.length > 1) {
    const next = [];
    let i = 0;
    while (i + 1 < level.length) {
      next.push(await hashPair(level[i], level[i + 1]));
      i += 2;
    }
    if (i < level.length) next.push(level[i]);
    level = next;
  }
  return level[0];
}

export async function merkleProof(leaves, index) {
  if (!Array.isArray(leaves)) throw new TypeError("leaves must be an array");
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
    throw new RangeError(`merkle: index ${index} out of range for ${leaves.length} leaves`);
  }
  for (const leaf of leaves) assertBytes32(leaf, "leaf");

  const proof = [];
  let level = leaves.map((leaf) => leaf.slice());
  let current = index;

  while (level.length > 1) {
    const next = [];
    let i = 0;
    while (i + 1 < level.length) {
      next.push(await hashPair(level[i], level[i + 1]));
      if (i === current || i + 1 === current) {
        proof.push((i === current ? level[i + 1] : level[i]).slice());
        current = next.length - 1;
      }
      i += 2;
    }
    if (i < level.length) {
      next.push(level[i]);
      if (i === current) current = next.length - 1;
    }
    level = next;
  }

  return proof;
}

export async function verifyProof(leaf, proof, root) {
  try {
    assertBytes32(leaf, "leaf");
    assertBytes32(root, "root");
    if (!Array.isArray(proof)) return false;
    let current = leaf.slice();
    for (const sibling of proof) {
      assertBytes32(sibling, "proof sibling");
      current = await hashPair(current, sibling);
    }
    return bytesEqual(current, root);
  } catch {
    return false;
  }
}

export function bytesToHex(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("bytes must be a Uint8Array");
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToBytes(hex) {
  if (typeof hex !== "string") throw new TypeError("hex must be a string");
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (raw.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(raw)) {
    throw new TypeError("hex must contain an even number of hexadecimal characters");
  }
  return Uint8Array.from(raw.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
}

export function bytesEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) {
    return false;
  }
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

export async function buildProofBundle(parts, index) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new TypeError("parts must be a non-empty array of Uint8Array values");
  }
  const leaves = await Promise.all(parts.map((part) => sha256Leaf(part)));
  const root = await merkleRoot(leaves);
  const proof = await merkleProof(leaves, index);
  return {
    algorithm: "sha256-sorted-pair-promote-odd/v1",
    index,
    leaf: bytesToHex(leaves[index]),
    root: bytesToHex(root),
    proof: proof.map(bytesToHex),
  };
}

export async function verifyProofBundle(bundle) {
  if (!bundle || bundle.algorithm !== "sha256-sorted-pair-promote-odd/v1") return false;
  try {
    return verifyProof(
      hexToBytes(bundle.leaf),
      bundle.proof.map(hexToBytes),
      hexToBytes(bundle.root),
    );
  } catch {
    return false;
  }
}
