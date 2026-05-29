/**
 * Local session-key manager.
 *
 * A session key is a fresh secp256k1 keypair generated in the browser and
 * persisted to localStorage. The user signs a *delegation envelope* with their
 * main wallet that grants the session key authority to anchor on the user's
 * behalf — useful for streamed/batched anchoring (e.g., a stream of audit
 * events from a service).
 *
 * **Scope of this MVP:** the delegation is recorded off-chain. The on-chain
 * registry still records `msg.sender`; if the session key were to submit
 * directly, the publisher field on-chain would be the session-key address, not
 * the user's main wallet. A future contract extension can pick up the
 * delegation and treat anchors-by-delegate as anchors-by-delegator.
 *
 * Future direction: ERC-4337 SCA with the session key as a signer module. Out
 * of scope for the starter.
 */

import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { Address } from "viem";

const STORAGE_KEY = "arc-merkle-anchor:session-key:v1";
const DELEGATION_KEY = "arc-merkle-anchor:delegation:v1";

interface StoredKey {
  privateKey: `0x${string}`;
  address: Address;
  createdAt: number;
}

export interface Delegation {
  delegator: Address;
  sessionKey: Address;
  contract: Address;
  expiresAt: number;
  /** EIP-191 signature from the delegator. */
  signature: `0x${string}`;
}

export function loadSessionKey(): StoredKey | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredKey;
  } catch {
    return null;
  }
}

export function clearSessionKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(DELEGATION_KEY);
}

export function generateSessionKey(): StoredKey {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const stored: StoredKey = {
    privateKey,
    address: account.address,
    createdAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }
  return stored;
}

export function buildDelegationMessage(d: Omit<Delegation, "signature">): string {
  // Human-readable so the user can sanity-check what they're signing in the
  // wallet popup. JSON keys sorted for byte-stability.
  return JSON.stringify(
    {
      contract: d.contract,
      delegator: d.delegator,
      expires_at: d.expiresAt,
      kind: "arc-merkle-anchor.session-key-delegation/v1",
      session_key: d.sessionKey,
    },
    null,
    2,
  );
}

export function saveDelegation(d: Delegation): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELEGATION_KEY, JSON.stringify(d));
}

export function loadDelegation(): Delegation | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DELEGATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Delegation;
  } catch {
    return null;
  }
}
