import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Arc Merkle Anchor — Starter kit",
  description:
    "Anchor any artifact on Arc with a Merkle root. Prove inclusion of any sub-part with a small proof. ~$0.001 USDC per anchor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-950 text-neutral-100">
        <Providers>
          <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4">
            <header className="flex items-center justify-between border-b border-neutral-800 py-4">
              <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
                arc-merkle-anchor
              </Link>
              <nav className="flex items-center gap-1 text-xs">
                <Link href="/anchor" className="rounded-md px-2 py-1 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                  Anchor
                </Link>
                <Link href="/verify" className="rounded-md px-2 py-1 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                  Verify
                </Link>
                <Link href="/session-keys" className="rounded-md px-2 py-1 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                  Session keys
                </Link>
              </nav>
            </header>
            <main className="flex-1 py-8">{children}</main>
            <footer className="border-t border-neutral-800 py-4 text-xs text-neutral-500">
              Arc Testnet · chain id 5042002 ·{" "}
              <a
                href="https://github.com/tang-vu/arc-merkle-anchor"
                className="text-neutral-300 underline hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                source
              </a>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
