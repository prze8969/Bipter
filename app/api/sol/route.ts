import { NextResponse } from "next/server";
import { LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import { connection, keypairFromEnv, parseWallet, rateLimit, unlimit } from "@/lib/server/keys";

export const runtime = "nodejs";
/** 0.2 devnet SOL: enough for hundreds of txs; keeps the sponsor (about 0.9 SOL) usable by several testers. */
const DRIP = 0.2 * LAMPORTS_PER_SOL;

/** Send 0.2 devnet SOL from the funded sponsor key; fall back to a devnet airdrop. One per wallet per 10 min. */
export async function POST(req: Request) {
  let key = "";
  try {
    const { wallet } = await req.json();
    const to = parseWallet(wallet);
    key = `sol:${to.toBase58()}`;
    const wait = rateLimit(key, 10 * 60_000);
    if (wait) return NextResponse.json({ error: `SOL cooldown: try again in ${wait}s, or use faucet.solana.com` }, { status: 429 });
    const conn = connection();

    let sponsorError = "";
    try {
      const sponsor = keypairFromEnv("SPONSOR_SECRET");
      const tx = new Transaction().add(SystemProgram.transfer({ fromPubkey: sponsor.publicKey, toPubkey: to, lamports: DRIP }));
      const sig = await conn.sendTransaction(tx, [sponsor]);
      await conn.confirmTransaction(sig, "confirmed");
      return NextResponse.json({ sig, via: "sponsor" });
    } catch (e) {
      sponsorError = e instanceof Error ? e.message : String(e);
    }
    try {
      const sig = await conn.requestAirdrop(to, DRIP);
      await conn.confirmTransaction(sig, "confirmed");
      return NextResponse.json({ sig, via: "airdrop" });
    } catch (e) {
      unlimit(key);
      return NextResponse.json(
        { error: `Could not get devnet SOL (sponsor: ${sponsorError.slice(0, 80)}; airdrop: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}). Use faucet.solana.com` },
        { status: 502 },
      );
    }
  } catch (e) {
    if (key) unlimit(key);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
