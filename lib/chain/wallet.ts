import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const KEY = "bipter.wallet.v1";

/** Prototype wallet: a keypair generated in the browser and kept in localStorage. No auth. */
export function loadOrCreateKeypair(): Keypair {
  const existing = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  if (existing) {
    try {
      return Keypair.fromSecretKey(bs58.decode(existing));
    } catch {
      /* fall through and regenerate */
    }
  }
  const kp = Keypair.generate();
  try {
    localStorage.setItem(KEY, bs58.encode(kp.secretKey));
  } catch {
    /* private mode: wallet lives for this page only */
  }
  return kp;
}

export function resetWallet() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
