import "server-only";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { RPC_URL } from "@/lib/chain/config";

/** Throwaway devnet keys from env (base58 secret key or JSON byte array). Never logged. */
export function keypairFromEnv(name: "SPONSOR_SECRET" | "MINT_AUTHORITY_SECRET" | "ADMIN_SECRET"): Keypair {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set on the server`);
  try {
    return Keypair.fromSecretKey(v.startsWith("[") ? Uint8Array.from(JSON.parse(v)) : bs58.decode(v));
  } catch {
    throw new Error(`${name} is not a valid secret key`);
  }
}

export const connection = () => new Connection(RPC_URL, "confirmed");

export function parseWallet(v: unknown): PublicKey {
  if (typeof v !== "string") throw new Error("wallet is required");
  try {
    return new PublicKey(v);
  } catch {
    throw new Error("wallet is not a valid public key");
  }
}

/** In-memory per-key cooldown (prototype; resets on server restart / per serverless instance). */
const last = new Map<string, number>();
export function rateLimit(key: string, ms: number): number {
  const now = Date.now();
  const prev = last.get(key) ?? 0;
  if (now - prev < ms) return Math.ceil((ms - (now - prev)) / 1000);
  last.set(key, now);
  return 0;
}
export function unlimit(key: string) {
  last.delete(key);
}
