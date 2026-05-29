"use client";

/**
 * Lists the connected wallet's previous anchors by querying the contract's
 * `Anchored` event log.
 *
 * Read-only via the public client; doesn't hit any backend.
 */

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";

import { REGISTRY_ADDRESS } from "@/lib/registry-abi";

const ANCHORED_EVENT = parseAbiItem(
  "event Anchored(uint256 indexed id, address indexed publisher, bytes32 indexed artifactId, bytes32 contentHash, bytes32 merkleRoot, bytes16 schemaVersion, string contentCid, uint64 anchoredAt)",
);

interface AnchorRow {
  id: bigint;
  artifactId: `0x${string}`;
  contentHash: `0x${string}`;
  merkleRoot: `0x${string}`;
  cid: string;
  anchoredAt: bigint;
  txHash: `0x${string}`;
}

const PAGE_BLOCKS = BigInt(50000);
const ZERO_BLOCK = BigInt(0);
const ONE_BLOCK = BigInt(1);

export function AnchorsList() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const [rows, setRows] = useState<AnchorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isConnected || !address || !client) return;
      setLoading(true);
      setError(null);
      try {
        const latest = await client.getBlockNumber();
        // RPC providers cap getLogs ranges; walk back in 50k-block windows
        // until we either find ~10 rows or have scanned ~200k blocks.
        const collected: AnchorRow[] = [];
        let to = latest;
        for (let pages = 0; pages < 5 && collected.length < 10; pages++) {
          const from = to > PAGE_BLOCKS ? to - PAGE_BLOCKS : ZERO_BLOCK;
          const logs = await client.getLogs({
            address: REGISTRY_ADDRESS,
            event: ANCHORED_EVENT,
            args: { publisher: address },
            fromBlock: from,
            toBlock: to,
          });
          for (const log of logs) {
            const args = log.args as {
              id: bigint;
              artifactId: `0x${string}`;
              contentHash: `0x${string}`;
              merkleRoot: `0x${string}`;
              contentCid: string;
              anchoredAt: bigint;
            };
            collected.push({
              id: args.id,
              artifactId: args.artifactId,
              contentHash: args.contentHash,
              merkleRoot: args.merkleRoot,
              cid: args.contentCid,
              anchoredAt: args.anchoredAt,
              txHash: log.transactionHash,
            });
          }
          if (from === ZERO_BLOCK) break;
          to = from - ONE_BLOCK;
        }
        if (cancelled) return;
        collected.sort((a, b) => Number(b.id - a.id));
        setRows(collected.slice(0, 10));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [address, client, isConnected]);

  if (!isConnected) {
    return <p className="text-sm text-neutral-400">Connect a wallet to see your anchors.</p>;
  }
  if (loading) {
    return <p className="text-sm text-neutral-400">Scanning recent blocks for your anchors…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-300">Could not fetch: {error.split("\n")[0]}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No anchors found for this wallet yet. Go to{" "}
        <a href="/anchor" className="underline">
          /anchor
        </a>{" "}
        to make your first.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={`${r.id}-${r.txHash}`}
          className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4"
        >
          <div className="flex items-baseline justify-between">
            <div className="font-mono text-xs text-neutral-400">anchor #{String(r.id)}</div>
            <a
              href={`https://testnet.arcscan.app/tx/${r.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-neutral-300 underline"
            >
              tx
            </a>
          </div>
          <dl className="mt-2 grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-[110px_1fr]">
            <dt className="text-neutral-500">root</dt>
            <dd className="break-all font-mono text-emerald-300">{r.merkleRoot}</dd>
            <dt className="text-neutral-500">artifactId</dt>
            <dd className="break-all font-mono text-neutral-200">{r.artifactId}</dd>
            <dt className="text-neutral-500">CID</dt>
            <dd className="break-all font-mono text-neutral-200">{r.cid}</dd>
            <dt className="text-neutral-500">when</dt>
            <dd className="font-mono text-neutral-200">
              {new Date(Number(r.anchoredAt) * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC
            </dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}
