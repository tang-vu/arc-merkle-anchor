import { InclusionVerifier } from "@/components/inclusion-verifier";

export const metadata = { title: "Verify — Arc Merkle Anchor" };

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Verify an inclusion proof</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Read-only — runs <span className="font-mono">verifyInclusion</span> via{" "}
          <span className="font-mono">eth_call</span>. No signature, no gas. The local recompute below
          mirrors what the contract is doing.
        </p>
      </header>
      <InclusionVerifier />
    </div>
  );
}
