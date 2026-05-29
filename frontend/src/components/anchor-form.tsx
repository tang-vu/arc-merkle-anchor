"use client";

/**
 * Drag-a-file → compute Merkle root in browser → sign → send anchor() tx.
 *
 * No file leaves the browser. The contentHash + Merkle root we display are
 * computed locally; only the 32-byte root + a CID for the full bytes land
 * on-chain.
 */

import { useState, type FormEvent } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, stringToBytes, stringToHex, padHex, type Hex } from "viem";

import { chunkFile, humanBytes, type ChunkedFile, DEFAULT_CHUNK_SIZE } from "@/lib/chunk";
import { bytesToHex, merkleRoot } from "@/lib/merkle-client";
import {
  MerkleAnchorRegistryAbi,
  REGISTRY_ADDRESS,
  DEFAULT_SCHEMA,
} from "@/lib/registry-abi";

function padSchema(s: string): Hex {
  // bytes16 — 16 bytes, ASCII-packed left, zero-padded right.
  return padHex(stringToHex(s), { size: 16, dir: "right" });
}

function defaultArtifactId(name: string): Hex {
  // keccak256 of the file name. Forks can plug in their own scheme.
  return keccak256(stringToBytes(name || "untitled"));
}

export function AnchorForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const correctChain = chainId === 5042002;

  const [file, setFile] = useState<File | null>(null);
  const [computing, setComputing] = useState(false);
  const [computed, setComputed] = useState<ChunkedFile | null>(null);
  const [chunkSize, setChunkSize] = useState(DEFAULT_CHUNK_SIZE);
  const [artifactId, setArtifactId] = useState("");
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [contentCid, setContentCid] = useState("");

  const { writeContract, data: txHash, error: writeError, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed, data: receipt } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  async function onFileChange(f: File | null) {
    setFile(f);
    setComputed(null);
    reset();
    if (!f) return;
    setComputing(true);
    try {
      const out = await chunkFile(f, chunkSize);
      setComputed(out);
      if (!artifactId) setArtifactId(f.name);
    } finally {
      setComputing(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!computed || !contentCid) return;

    const aid = artifactId.startsWith("0x") && artifactId.length === 66
      ? (artifactId as Hex)
      : defaultArtifactId(artifactId);

    writeContract({
      abi: MerkleAnchorRegistryAbi,
      address: REGISTRY_ADDRESS,
      functionName: "anchor",
      args: [
        aid,
        bytesToHex(computed.contentHash) as Hex,
        bytesToHex(merkleRoot(computed.leaves)) as Hex,
        padSchema(schema),
        contentCid,
      ],
      chainId: 5042002,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <legend className="px-2 text-xs uppercase tracking-wider text-neutral-400">1 · Pick a file</legend>
        <input
          type="file"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-sm file:text-neutral-100 hover:file:bg-neutral-700"
        />
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          chunk size
          <select
            value={chunkSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setChunkSize(n);
              if (file) onFileChange(file);
            }}
            className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
          >
            <option value={4096}>4 KiB</option>
            <option value={16384}>16 KiB</option>
            <option value={65536}>64 KiB (default)</option>
            <option value={262144}>256 KiB</option>
            <option value={1048576}>1 MiB</option>
          </select>
        </label>
      </fieldset>

      {computing && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-300">
          Computing Merkle root…
        </div>
      )}

      {computed && (
        <fieldset className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <legend className="px-2 text-xs uppercase tracking-wider text-neutral-400">2 · Inspect what gets anchored</legend>
          <dl className="grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-[160px_1fr]">
            <dt className="text-neutral-500">total bytes</dt>
            <dd className="font-mono text-neutral-200">{humanBytes(computed.totalBytes)} · {computed.chunks.length} chunks</dd>
            <dt className="text-neutral-500">contentHash</dt>
            <dd className="break-all font-mono text-neutral-200">{bytesToHex(computed.contentHash)}</dd>
            <dt className="text-neutral-500">merkleRoot</dt>
            <dd className="break-all font-mono text-emerald-300">{bytesToHex(merkleRoot(computed.leaves))}</dd>
          </dl>
          <p className="text-xs text-neutral-500">
            Hashes are computed in your browser. Nothing has been sent anywhere yet.
          </p>
        </fieldset>
      )}

      {computed && (
        <fieldset className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
          <legend className="px-2 text-xs uppercase tracking-wider text-neutral-400">3 · Anchor metadata</legend>
          <label className="block text-xs text-neutral-400">
            artifact id (free text → keccak256, or paste a bytes32 hex)
            <input
              value={artifactId}
              onChange={(e) => setArtifactId(e.target.value)}
              placeholder="my-artifact.tar.gz"
              className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            schema version (≤16 chars ASCII)
            <input
              value={schema}
              onChange={(e) => setSchema(e.target.value.slice(0, 16))}
              className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            content CID (Irys / IPFS / Arweave / S3 url — must be non-empty)
            <input
              value={contentCid}
              onChange={(e) => setContentCid(e.target.value)}
              placeholder="bafy… or ar://… or s3://…"
              required
              className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
            />
          </label>
        </fieldset>
      )}

      {!isConnected && (
        <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-4 text-sm text-amber-300">
          Connect your wallet to send the anchor transaction.
        </div>
      )}
      {isConnected && !correctChain && (
        <div className="rounded-xl border border-amber-700/30 bg-amber-900/10 p-4 text-sm text-amber-300">
          Wallet is on chain {chainId}. Switch to Arc Testnet (5042002) to anchor.
        </div>
      )}

      <button
        type="submit"
        disabled={!computed || !contentCid || !isConnected || !correctChain || isPending || confirming}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-neutral-700"
      >
        {isPending
          ? "Waiting for wallet…"
          : confirming
            ? "Confirming on Arc…"
            : confirmed
              ? "Anchored ✓"
              : "Sign & anchor"}
      </button>

      {writeError && (
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4 text-sm text-red-300">
          {writeError.message.split("\n")[0]}
        </div>
      )}
      {confirmed && receipt && (
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-900/10 p-4 text-sm text-emerald-200">
          Anchored in block {String(receipt.blockNumber)}. Tx:{" "}
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="break-all font-mono underline"
          >
            {txHash}
          </a>
          {address && (
            <p className="mt-2 text-xs text-emerald-300/80">
              You can now generate inclusion proofs for any chunk via the python prover, or use{" "}
              <a href="/verify" className="underline">
                /verify
              </a>{" "}
              to test one.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
