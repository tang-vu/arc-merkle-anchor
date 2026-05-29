/**
 * Minimal ABI extract for `MerkleAnchorRegistry`.
 *
 * Generated from `src/MerkleAnchorRegistry.sol`. Only the entries the frontend
 * actually uses — keeps the bundle small + the type inference fast.
 */

export const MerkleAnchorRegistryAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "anchor",
    inputs: [
      { name: "artifactId", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "schemaVersion", type: "bytes16" },
      { name: "contentCid", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "pure",
    name: "verifyInclusion",
    inputs: [
      { name: "root", type: "bytes32" },
      { name: "leaf", type: "bytes32" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "view",
    name: "totalAnchors",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Anchored",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "publisher", type: "address", indexed: true },
      { name: "artifactId", type: "bytes32", indexed: true },
      { name: "contentHash", type: "bytes32", indexed: false },
      { name: "merkleRoot", type: "bytes32", indexed: false },
      { name: "schemaVersion", type: "bytes16", indexed: false },
      { name: "contentCid", type: "string", indexed: false },
      { name: "anchoredAt", type: "uint64", indexed: false },
    ],
  },
] as const;

/** Live registry address on Arc Testnet (chain id 5042002). Override at build
 * time via NEXT_PUBLIC_REGISTRY_ADDRESS for forks pointing at a self-hosted
 * deployment. */
export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
  "0x707B2243583CC6A9bda9AF5EAF02720042917769") as `0x${string}`;

/** Default schema version packed into 16-byte ASCII for the anchor() call. */
export const DEFAULT_SCHEMA = "anchor/1";
