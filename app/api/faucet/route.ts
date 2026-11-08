import { NextResponse } from "next/server";
import { Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction } from "@solana/spl-token";
import { USDC_MINT } from "@/lib/chain/config";
import { ata } from "@/lib/chain/program";
import { connection, keypairFromEnv, parseWallet, rateLimit, unlimit } from "@/lib/server/keys";

export const runtime = "nodejs";
const AMOUNT = 100_000_000; // 100 test USDC

/** Mint 100 devnet test USDC to a wallet. One request per wallet per 30 s. */
export async function POST(req: Request) {
  let key = "";
  try {
    const { wallet } = await req.json();
    const owner = parseWallet(wallet);
    if (!USDC_MINT) throw new Error("NEXT_PUBLIC_USDC_MINT is not set");
    key = `usdc:${owner.toBase58()}`;
    const wait = rateLimit(key, 30_000);
    if (wait) return NextResponse.json({ error: `Faucet cooldown: try again in ${wait}s` }, { status: 429 });

    const auth = keypairFromEnv("MINT_AUTHORITY_SECRET");
    const conn = connection();
    const dest = ata(USDC_MINT, owner);
    const tx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(auth.publicKey, dest, owner, USDC_MINT),
      createMintToInstruction(USDC_MINT, dest, auth.publicKey, AMOUNT),
    );
    const sig = await conn.sendTransaction(tx, [auth]);
    await conn.confirmTransaction(sig, "confirmed");
    return NextResponse.json({ sig, amount: AMOUNT });
  } catch (e) {
    if (key) unlimit(key);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
