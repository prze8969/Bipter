import { PublicKey } from "@solana/web3.js";
import type { ChainMode } from "./types";

/** Devnet is the default. "simulated" only when explicitly set (local development). */
export const CHAIN_MODE: ChainMode = process.env.NEXT_PUBLIC_CHAIN_MODE === "simulated" ? "simulated" : "devnet";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

function pk(v: string | undefined): PublicKey | null {
  if (!v) return null;
  try {
    return new PublicKey(v);
  } catch {
    return null;
  }
}

export const PROGRAM_ID = pk(process.env.NEXT_PUBLIC_PROGRAM_ID);
export const USDC_MINT = pk(process.env.NEXT_PUBLIC_USDC_MINT);
export const MERCHANT = pk(process.env.NEXT_PUBLIC_MERCHANT);

/** Names of missing public config values (shown in the UI instead of failing silently). */
export function missingConfig(): string[] {
  const m: string[] = [];
  if (!PROGRAM_ID) m.push("NEXT_PUBLIC_PROGRAM_ID");
  if (!USDC_MINT) m.push("NEXT_PUBLIC_USDC_MINT");
  if (!MERCHANT) m.push("NEXT_PUBLIC_MERCHANT");
  return m;
}
