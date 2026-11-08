import { NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/chain/config";
import { ixAdminForceDue } from "@/lib/chain/program";
import { connection, keypairFromEnv } from "@/lib/server/keys";

export const runtime = "nodejs";

/** DEMO ONLY: admin_force_due on a loan so the next installment can be collected now. */
export async function POST(req: Request) {
  try {
    const { loan } = await req.json();
    if (!PROGRAM_ID) throw new Error("NEXT_PUBLIC_PROGRAM_ID is not set");
    const loanPk = new PublicKey(String(loan));
    const admin = keypairFromEnv("ADMIN_SECRET");
    const conn = connection();
    const owner = (await conn.getAccountInfo(loanPk))?.owner;
    if (!owner?.equals(PROGRAM_ID)) throw new Error("Not a Bipter loan account");
    const tx = new Transaction().add(ixAdminForceDue(PROGRAM_ID, admin.publicKey, loanPk));
    const sig = await conn.sendTransaction(tx, [admin]);
    await conn.confirmTransaction(sig, "confirmed");
    return NextResponse.json({ sig });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: /0x1774/.test(msg) ? "Loan is not active" : msg }, { status: 400 });
  }
}
