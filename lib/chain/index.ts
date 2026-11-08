import type { ChainAdapter, ChainMode } from "./types";
import { simulatedAdapter } from "./simulated";

export const CHAIN_MODE: ChainMode =
  process.env.NEXT_PUBLIC_CHAIN_MODE === "devnet" ? "devnet" : "simulated";

/**
 * Devnet adapter is M3 and needs the deployed program ID + IDL + env keys.
 * Until then devnet mode fails loudly instead of silently pretending.
 */
const devnetNotReady: ChainAdapter = new Proxy({ mode: "devnet" } as ChainAdapter, {
  get(target, prop) {
    if (prop === "mode") return "devnet";
    return async () => {
      throw new Error("Devnet adapter not built yet (needs program ID, IDL and .env). Use NEXT_PUBLIC_CHAIN_MODE=simulated.");
    };
  },
});

export function getAdapter(): ChainAdapter {
  return CHAIN_MODE === "devnet" ? devnetNotReady : simulatedAdapter;
}

export * from "./types";
