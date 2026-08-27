export interface ProofBundle {
  algorithm: "sha256-sorted-pair-promote-odd/v1";
  index: number;
  leaf: string;
  root: string;
  proof: string[];
}

export function sha256Leaf(data: Uint8Array): Promise<Uint8Array>;
export function merkleRoot(leaves: Uint8Array[]): Promise<Uint8Array>;
export function merkleProof(leaves: Uint8Array[], index: number): Promise<Uint8Array[]>;
export function verifyProof(
  leaf: Uint8Array,
  proof: Uint8Array[],
  root: Uint8Array,
): Promise<boolean>;
export function bytesToHex(bytes: Uint8Array): string;
export function hexToBytes(hex: string): Uint8Array;
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean;
export function buildProofBundle(parts: Uint8Array[], index: number): Promise<ProofBundle>;
export function verifyProofBundle(bundle: ProofBundle): Promise<boolean>;
