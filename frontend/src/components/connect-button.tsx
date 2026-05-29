"use client";

import { ConnectKitButton } from "connectkit";

/**
 * Thin wrapper around ConnectKit's default button. Styled to fit the layout's
 * dark theme. Exposed as a single import path so pages don't import directly
 * from connectkit (easier to swap providers later).
 */
export function ConnectButton() {
  return <ConnectKitButton showAvatar={false} showBalance />;
}
