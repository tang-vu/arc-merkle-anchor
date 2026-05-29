"use client";

/**
 * Inclusion-proof verifier.
 *
 * Pure read-only — runs `verifyInclusion` via eth_call. No wallet signature,
 * no gas. Also shows the fold steps so the user can sanity-check what the
 * contract is computing.
 */

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import type { Hex } from "viem";
import { sha256 } from "@noble/hashes/sha2.js";

import { hexToBytes, bytesToHex, verifyProof } from "@/lib/merkle-client";
import { MerkleAnchorRegistryAbi, REGISTRY_ADDRESS } from "@/lib/registry-abi";

function parseProof(s: string): Hex[] | null {
  const trimmed = s.trim();
  if (!trimmed) return [];
  // Accept JSON array OR newline/comma-separated hex.
  try {
    if (trimmed.startsWith("[")) {
      const arr = JSON.parse(trimmed) as unknown[];
      const hex = arr.filter((v): v is string => typeof v === "string").map((v) => (v.startsWith("0x") ? v : `0x${v}`)) as Hex[];
      return hex;
    }
  } catch {
    // fall through
  }
  const parts = trimmed.split(/[\n,\s]+/).filter(Boolean);
  return parts.map((p) => (p.startsWith("0x") ? p : `0x${p}`)) as Hex[];
}

function isBytes32(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

export function InclusionVerifier() {
  const [root, setRoot] = useState("");
  const [leaf, setLeaf] = useState("");
  const [proofText, setProofText] = useState("");

  const proof = useMemo(() => parseProof(proofText), [proofText]);
  const inputsValid =
    isBytes32(root) && isBytes32(leaf) && proof !== null && proof.every((p) => isBytes32(p));

  const onChain = useReadContract({
    abi: MerkleAnchorRegistryAbi,
    address: REGISTRY_ADDRESS,
    functionName: "verifyInclusion",
    args: inputsValid ? [root as Hex, leaf as Hex, proof!] : undefined,
    chainId: 5042002,
    query: { enabled: inputsValid },
  });

  const local = useMemo(() => {
    if (!inputsValid) return null;
    try {
      return verifyProof(hexToBytes(leaf), proof!.map((p) => hexToBytes(p)), hexToBytes(root));
    } catch {
      return null;
    }
  }, [inputsValid, leaf, proof, root]);

  const foldSteps = useMemo(() => {
    if (!inputsValid) return [];
    const steps: string[] = [];
    let h = hexToBytes(leaf);
    steps.push(`leaf       ${bytesToHex(h)}`);
    for (const [i, sib] of proof!.entries()) {
      const sibling = hexToBytes(sib);
      const next = (() => {
        // sorted-pair sha256 — same as on-chain
        const ab = (() => {
          for (let k = 0; k < 32; k++) {
            if (h[k] !== sibling[k]) return h[k] < sibling[k] ? [h, sibling] : [sibling, h];
          }
          return [h, sibling];
        })();
        const concat = new Uint8Array(64);
        concat.set(ab[0], 0);
        concat.set(ab[1], 32);
        return concat;
      })();
      h = sha256(next);
      steps.push(`step ${i + 1}     ${bytesToHex(h)}`);
    }
    return steps;
  }, [inputsValid, leaf, proof]);

  return (
    <div className="space-y-4">
      <label className="block text-xs text-neutral-400">
        merkleRoot (bytes32, 0x…)
        <input
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          placeholder="0x…"
          className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
        />
      </label>
      <label className="block text-xs text-neutral-400">
        leaf (bytes32 — sha256 of the sub-part being proven)
        <input
          value={leaf}
          onChange={(e) => setLeaf(e.target.value)}
          placeholder="0x…"
          className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
        />
      </label>
      <label className="block text-xs text-neutral-400">
        proof (JSON array of bytes32, or newline-separated hex)
        <textarea
          value={proofText}
          onChange={(e) => setProofText(e.target.value)}
          placeholder="[&quot;0x…&quot;, &quot;0x…&quot;]"
          rows={5}
          className="mt-1 block w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100"
        />
      </label>

      {inputsValid ? (
        <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-neutral-400">on-chain verifyInclusion</span>
            {onChain.isLoading && <span className="text-xs text-neutral-500">querying…</span>}
            {onChain.isSuccess && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  onChain.data ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"
                }`}
              >
                {onChain.data ? "✓ valid" : "✗ invalid"}
              </span>
            )}
            {onChain.error && <span className="text-xs text-red-300">error</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-neutral-400">local recompute</span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                local ? "bg-emerald-900/40 text-emerald-300" : "bg-red-900/40 text-red-300"
              }`}
            >
              {local ? "✓ valid" : "✗ invalid"}
            </span>
          </div>
          {foldSteps.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-neutral-400">fold trace ({foldSteps.length - 1} steps)</summary>
              <pre className="mt-2 max-h-64 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-[11px] text-neutral-300">
                {foldSteps.join("\n")}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          Enter a root, a leaf, and a proof (any number of siblings, bottom-up). The contract is read-only — verification costs nothing.
        </p>
      )}
    </div>
  );
}
