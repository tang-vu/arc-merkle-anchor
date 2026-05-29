import { AnchorForm } from "@/components/anchor-form";
import { ConnectButton } from "@/components/connect-button";

export const metadata = { title: "Anchor — Arc Merkle Anchor" };

export default function AnchorPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Anchor a file</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Hashed in your browser, signed by your wallet, settled on Arc.
          </p>
        </div>
        <ConnectButton />
      </header>
      <AnchorForm />
    </div>
  );
}
