import { ConnectButton } from "@/components/connect-button";
import { SessionKeyManager } from "@/components/session-key-manager";

export const metadata = { title: "Session keys — Arc Merkle Anchor" };

export default function SessionKeysPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Session keys</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Delegate anchoring authority to an ephemeral browser-side key — useful for streamed/
            batched anchors without prompting the wallet on every call.
          </p>
        </div>
        <ConnectButton />
      </header>
      <SessionKeyManager />
    </div>
  );
}
