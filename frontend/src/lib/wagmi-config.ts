/**
 * wagmi v2 config for Arc Testnet (chain id 5042002).
 *
 * Single-chain config — this starter targets Arc only. Forks pointing at a
 * different Arc deployment override `NEXT_PUBLIC_RPC_URL` at build time.
 *
 * **RPC recommendation:** for production deploys, point at your
 * Canteen-hosted Arc RPC (run `arc-canteen rpc-url` from the Canteen CLI to
 * get yours). Canteen ties on-chain activity from that RPC to your GitHub
 * handle for builder-leaderboard credit + post-event grant eligibility.
 * The generic default below is for first-time `pnpm dev` runs.
 */

import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "connectkit";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc-testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

// Optional WalletConnect project id. Without it ConnectKit silently disables
// the WalletConnect connector — fine for a starter (MetaMask + browser
// extension wallets still work).
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "Arc Merkle Anchor",
    appDescription: "Anchor any artifact on Arc with a Merkle root.",
    appUrl: "https://github.com/tang-vu/arc-merkle-anchor",
    chains: [arcTestnet],
    transports: {
      [arcTestnet.id]: http(rpcUrl),
    },
    walletConnectProjectId: wcProjectId,
    ssr: false,
  }),
);
