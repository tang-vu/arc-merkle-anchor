/**
 * File → 32-byte leaf hashes for the Merkle tree.
 *
 * Splits a `File` (or `Blob`) into fixed-size chunks and SHA-256s each chunk
 * to produce the leaves passed to `merkleRoot`. The contentHash anchored
 * separately is the SHA-256 of the full bytes.
 *
 * Default chunk size = 64 KiB. Power-of-two, large enough to keep tree depth
 * small on multi-MB files, small enough that proving a single sub-part is
 * still a meaningful granularity.
 */

import { sha256 } from "@noble/hashes/sha2.js";

import { sha256Leaf } from "./merkle-client";

export const DEFAULT_CHUNK_SIZE = 64 * 1024;

export interface ChunkedFile {
  /** SHA-256 over the entire file bytes — anchored as `contentHash`. */
  contentHash: Uint8Array;
  /** Per-chunk SHA-256 — these are the Merkle leaves. */
  leaves: Uint8Array[];
  /** Original chunk bytes — kept so the UI can show "what's in chunk N". */
  chunks: Uint8Array[];
  chunkSize: number;
  totalBytes: number;
}

export async function chunkFile(file: File | Blob, chunkSize = DEFAULT_CHUNK_SIZE): Promise<ChunkedFile> {
  if (chunkSize <= 0) throw new RangeError("chunkSize must be > 0");
  const buf = new Uint8Array(await file.arrayBuffer());
  const chunks: Uint8Array[] = [];
  const leaves: Uint8Array[] = [];
  for (let off = 0; off < buf.length; off += chunkSize) {
    const end = Math.min(off + chunkSize, buf.length);
    const chunk = buf.subarray(off, end);
    chunks.push(chunk);
    leaves.push(sha256Leaf(chunk));
  }
  // Single-chunk files still produce one leaf (== contentHash in that case).
  if (chunks.length === 0) {
    chunks.push(new Uint8Array(0));
    leaves.push(sha256Leaf(new Uint8Array(0)));
  }
  const contentHash = sha256(buf);
  return { contentHash, leaves, chunks, chunkSize, totalBytes: buf.length };
}

/** Pretty file-size formatter. */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MiB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}
