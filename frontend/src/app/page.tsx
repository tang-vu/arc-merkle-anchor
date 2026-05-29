import Link from "next/link";

import { AnchorsList } from "@/components/anchors-list";
import { ConnectButton } from "@/components/connect-button";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">Anchor any artifact on Arc.</h1>
        <p className="max-w-2xl text-neutral-300">
          A starter kit for Arc builders who need <strong>verifiable-data infrastructure</strong> — the
          missing companion to Arc&apos;s payment-flow reference repos. Commit a file&apos;s SHA-256 + Merkle
          root to an append-only on-chain registry; anyone holding the root can prove a sub-part was
          part of the original commitment with a ~96-byte proof.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectButton />
          <Link
            href="/anchor"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Anchor a file →
          </Link>
          <Link
            href="/verify"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-900"
          >
            Verify a proof
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Bullet n="1" title="Browser-side hashing">
          Drop a file in. SHA-256 + Merkle root are computed locally before the wallet ever sees
          anything. Nothing leaves your device until you sign.
        </Bullet>
        <Bullet n="2" title="One-call anchor">
          <span className="font-mono">anchor(artifactId, contentHash, merkleRoot, schemaVersion, cid)</span>.
          ~$0.001 USDC. Source-verified on Arc Testnet.
        </Bullet>
        <Bullet n="3" title="On-chain verifyInclusion">
          A ~200-byte proof + a leaf + a root → ✓ or ✗ via a free <span className="font-mono">eth_call</span>.
          No trust in the publisher.
        </Bullet>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Your recent anchors</h2>
        <AnchorsList />
      </section>
    </div>
  );
}

function Bullet({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="font-mono text-xs text-neutral-500">{n}</div>
      <h3 className="mt-1 text-sm font-semibold text-neutral-100">{title}</h3>
      <p className="mt-2 text-sm text-neutral-300">{children}</p>
    </article>
  );
}
