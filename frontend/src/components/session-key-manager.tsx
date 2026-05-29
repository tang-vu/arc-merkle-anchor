"use client";

/**
 * Session-key UX.
 *
 * Generate a fresh secp256k1 key in the browser, sign a human-readable
 * delegation envelope with the connected wallet, persist both to
 * localStorage. The delegation is recorded off-chain — see
 * `lib/session-key.ts` for the scope note.
 */

import { useEffect, useState } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import type { Address } from "viem";

import { REGISTRY_ADDRESS } from "@/lib/registry-abi";
import {
  buildDelegationMessage,
  clearSessionKey,
  generateSessionKey,
  loadDelegation,
  loadSessionKey,
  saveDelegation,
  type Delegation,
} from "@/lib/session-key";

const DELEGATION_TTL_S = 60 * 60 * 24 * 7; // 7 days

export function SessionKeyManager() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [sessionAddr, setSessionAddr] = useState<Address | null>(null);
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { signMessageAsync, isPending } = useSignMessage();

  useEffect(() => {
    const sk = loadSessionKey();
    setSessionAddr(sk?.address ?? null);
    setDelegation(loadDelegation());
  }, []);

  async function onGenerate() {
    setError(null);
    const sk = generateSessionKey();
    setSessionAddr(sk.address);
  }

  function onClear() {
    clearSessionKey();
    setSessionAddr(null);
    setDelegation(null);
  }

  async function onDelegate() {
    setError(null);
    if (!address || !sessionAddr) return;
    const partial = {
      delegator: address,
      sessionKey: sessionAddr,
      contract: REGISTRY_ADDRESS,
      expiresAt: Math.floor(Date.now() / 1000) + DELEGATION_TTL_S,
    };
    try {
      const message = buildDelegationMessage(partial);
      const signature = await signMessageAsync({ message });
      const d: Delegation = { ...partial, signature };
      saveDelegation(d);
      setDelegation(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Session key</h2>
          {sessionAddr && (
            <button
              onClick={onClear}
              className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:text-white"
            >
              clear
            </button>
          )}
        </div>
        {sessionAddr ? (
          <dl className="grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-[110px_1fr]">
            <dt className="text-neutral-500">address</dt>
            <dd className="break-all font-mono text-neutral-200">{sessionAddr}</dd>
            <dt className="text-neutral-500">storage</dt>
            <dd className="text-neutral-300">localStorage — wiped on browser data clear</dd>
          </dl>
        ) : (
          <button
            onClick={onGenerate}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500"
          >
            Generate session key
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Delegation envelope</h2>
          {delegation && (
            <span className="rounded-md bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-300">signed</span>
          )}
        </div>
        {!isConnected && (
          <p className="text-xs text-neutral-400">Connect your wallet to sign a delegation.</p>
        )}
        {isConnected && !sessionAddr && (
          <p className="text-xs text-neutral-400">Generate a session key first.</p>
        )}
        {isConnected && sessionAddr && !delegation && (
          <button
            onClick={onDelegate}
            disabled={isPending}
            className="rounded-md bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Waiting for wallet…" : "Sign delegation"}
          </button>
        )}
        {delegation && (
          <dl className="grid grid-cols-1 gap-y-1 text-xs sm:grid-cols-[110px_1fr]">
            <dt className="text-neutral-500">delegator</dt>
            <dd className="break-all font-mono text-neutral-200">{delegation.delegator}</dd>
            <dt className="text-neutral-500">session key</dt>
            <dd className="break-all font-mono text-neutral-200">{delegation.sessionKey}</dd>
            <dt className="text-neutral-500">contract</dt>
            <dd className="break-all font-mono text-neutral-200">{delegation.contract}</dd>
            <dt className="text-neutral-500">expires</dt>
            <dd className="font-mono text-neutral-200">
              {new Date(delegation.expiresAt * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC
            </dd>
            <dt className="text-neutral-500">signature</dt>
            <dd className="break-all font-mono text-neutral-300">{delegation.signature}</dd>
          </dl>
        )}
        {error && (
          <p className="text-xs text-red-300">{error.split("\n")[0]}</p>
        )}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-5 text-xs text-neutral-400">
        <p className="leading-relaxed">
          <strong className="text-neutral-200">Scope.</strong> This MVP records the delegation off-chain — perfect for a service that
          batches anchors locally, but the on-chain registry still attributes the publisher to whichever EOA signs the tx. A future
          contract extension can pick up the delegation envelope and treat anchors-by-delegate as anchors-by-delegator. Chain id:{" "}
          <span className="font-mono text-neutral-200">{chainId}</span>.
        </p>
      </section>
    </div>
  );
}
