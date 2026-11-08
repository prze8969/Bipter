/* Drives the browser devnet adapter (lib/chain/devnet.ts) from node, with a keypair standing in for Phantom.
 * Covers what e2e-devnet does not: the app's checkout tx (ATAs, init_credit, approve cap across 2 loans),
 * getProgramAccounts loan listing, credit read, pay_installment via the adapter, and tx history for receipts. */
import { loadEnv, keypair } from "./env";
loadEnv();
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction, type VersionedTransaction } from "@solana/web3.js";
import { getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

let failures = 0;
const check = (n: string, ok: boolean, info = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${info}`); };

async function main() {
  const { createDevnetAdapter } = await import("../lib/chain/devnet");
  const { ata, pdas } = await import("../lib/chain/program");
  const { USDC_MINT, PROGRAM_ID } = await import("../lib/chain/config");
  const { breakdownFor } = await import("../lib/pricing");
  const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, "confirmed");
  const sponsor = keypair("SPONSOR_SECRET"), mintAuth = keypair("MINT_AUTHORITY_SECRET"), admin = keypair("ADMIN_SECRET");
  const buyer = Keypair.generate();
  await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: sponsor.publicKey, toPubkey: buyer.publicKey, lamports: 0.03 * LAMPORTS_PER_SOL })), [sponsor]);
  const bAta = await getOrCreateAssociatedTokenAccount(conn, sponsor, USDC_MINT!, buyer.publicKey);
  await mintTo(conn, sponsor, USDC_MINT!, bAta.address, mintAuth, 100_000_000);

  const wallet = {
    publicKey: buyer.publicKey,
    // sign-only path (what the app now prefers); sendTransaction kept as the fallback
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
      (tx as Transaction).partialSign(buyer);
      return tx;
    },
    sendTransaction: async (tx: Transaction | VersionedTransaction, c: Connection) => {
      (tx as Transaction).partialSign(buyer);
      return c.sendRawTransaction((tx as Transaction).serialize());
    },
  };
  const a = createDevnetAdapter(conn, wallet as never);

  check("USDC balance 100", (await a.getBalance()) === 100_000_000);
  check("credit not created yet, limit 100", (await a.getCreditProfile()).exists === false);

  const b1 = breakdownFor(24, 1.5), b2 = breakdownFor(9, 1);
  const r1 = await a.createLoan({ label: "Wireless Earbuds", productIds: ["earbuds"], breakdown: b1 });
  console.log(`loan 1 ${r1.loan.id}  https://explorer.solana.com/tx/${r1.sig}?cluster=devnet`);
  const r2 = await a.createLoan({ label: "Phone Stand", productIds: ["phone-stand"], breakdown: b2 });
  console.log(`loan 2 ${r2.loan.id}  https://explorer.solana.com/tx/${r2.sig}?cluster=devnet`);
  const loans = await a.listLoans();
  check("listLoans finds 2 active loans", loans.length === 2 && loans.every((l) => l.status === "Active" && l.paid === 1));
  const cap = (await getAccount(conn, ata(USDC_MINT!, buyer.publicKey))).delegatedAmount;
  check("delegation covers both loans (3+3 installments)", cap === BigInt(3 * b1.installment + 3 * b2.installment), `got ${cap}`);
  check("delegate is pool PDA", (await getAccount(conn, ata(USDC_MINT!, buyer.publicKey))).delegate?.equals(pdas(PROGRAM_ID!).pool) === true);
  const c = await a.getCreditProfile();
  check("credit outstanding = both totals", c.outstanding === b1.totalOwed + b2.totalOwed, `got ${c.outstanding}`);

  try { await a.payNextInstallment(r1.loan.id); check("early collect rejected", false); }
  catch (e) { check("early collect rejected with friendly error", /not due/i.test((e as Error).message), `"${(e as Error).message}"`); }

  // force due as admin (what /api/admin/force-due does), then collect via the adapter
  const { ixAdminForceDue } = await import("../lib/chain/program");
  const { PublicKey } = await import("@solana/web3.js");
  await sendAndConfirmTransaction(conn, new Transaction().add(ixAdminForceDue(PROGRAM_ID!, admin.publicKey, new PublicKey(r1.loan.id))), [admin]);
  const p = await a.payNextInstallment(r1.loan.id);
  console.log(`collect #2 https://explorer.solana.com/tx/${p.sig}?cluster=devnet`);
  check("loan 1 paid=2", (await a.listLoans()).find((l) => l.id === r1.loan.id)?.paid === 2);

  const txs = await a.getLoanTxs(r1.loan.id);
  check("receipt history: create#1, force_due, installment#2", txs.map((t) => `${t.kind}${t.index ?? ""}`).join(",") === "create1,force_due,installment2", JSON.stringify(txs.map((t) => [t.kind, t.index])));
  check("receipt history has real fees", txs.every((t) => typeof t.feeLamports === "number" && t.feeLamports! > 0), `create fee ${txs[0]?.feeLamports} lamports`);

  const full = await a.payInFull(5_000_000, "test");
  check("pay in full transfer", !!full.sig, `https://explorer.solana.com/tx/${full.sig}?cluster=devnet`);

  console.log(`\n${failures ? `ADAPTER TEST FAILED (${failures})` : "ADAPTER TEST PASSED"}`);
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error("ADAPTER TEST ERROR:", e); process.exit(1); });
