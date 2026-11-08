/* Generate throwaway DEVNET keypairs into .env.local for any empty *_SECRET. Prints public keys only. */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { loadEnv, setEnv } from "./env";

loadEnv();
for (const name of ["SPONSOR_SECRET", "MINT_AUTHORITY_SECRET", "ADMIN_SECRET"]) {
  if (process.env[name]?.trim()) {
    console.log(`${name}: already set, kept`);
    continue;
  }
  const kp = Keypair.generate();
  setEnv(name, bs58.encode(kp.secretKey));
  if (name === "SPONSOR_SECRET") setEnv("NEXT_PUBLIC_SPONSOR", kp.publicKey.toBase58());
  console.log(`${name}: generated, public key ${kp.publicKey.toBase58()}`);
}
console.log("Fund the ADMIN and SPONSOR public keys with devnet SOL (faucet.solana.com), then run npm run setup:devnet");
