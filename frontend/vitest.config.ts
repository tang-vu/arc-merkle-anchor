import { defineConfig } from "vitest/config";

// Unit tests for the pure crypto helpers (merkle-client, chunk, session-key).
// Node environment — no DOM, no wallet, no network. The parity suite proves the
// browser Merkle implementation matches the Python prover byte-for-byte.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
