/* End-to-end on devnet against the deployed program:
 * new buyer -> fund SOL + 50 USDC -> create loan (approve + create_loan) -> force due + pay_installment x3
 * -> assert buyer, vault, merchant balances, loan status, credit limit. Exits 1 on any failure. */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createApproveInstruction, createAssociatedTokenAccountIdempotentInstruction, getAccount, mintTo, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { loadEnv, need, keypair } from "./env";
import { ata, decodeCredit, decodeLoan, ixAdminForceDue, ixCreateLoan, ixInitCredit, ixPayInstallment, pdas, tokenBalance } from "../lib/chain/program";
import { breakdownFor } from "../lib/pricing";

const ex = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
let failures = 0;
function check(name: string, got: bigint | number | string | boolean, want: bigint | number | string | boolean) {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got}${ok ? "" : `, want ${want}`}`);
}

async function main() {
  loadEnv();
  const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const programId = new PublicKey(need("NEXT_PUBLIC_PROGRAM_ID"));
  const mint = new PublicKey(need("NEXT_PUBLIC_USDC_MINT"));
  const merchant = new PublicKey(need("NEXT_PUBLIC_MERCHANT"));
  const admin = keypair("ADMIN_SECRET");
  const mintAuth = keypair("MINT_AUTHORITY_SECRET");
  const funder = process.env.SPONSOR_SECRET?.trim() ? keypair("SPONSOR_SECRET") : admin;
  const p = pdas(programId);

  // 1. fresh buyer with 0.02 SOL (pays its own fees + rent) and 50 test USDC
  const buyer = Keypair.generate();
  console.log(`buyer ${buyer.publicKey.toBase58()}`);
  let sig = await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: funder.publicKey, toPubkey: buyer.publicKey, lamports: 0.02 * LAMPORTS_PER_SOL })), [funder]);
  console.log(`funded SOL  ${ex(sig)}`);
  const buyerAta = await getOrCreateAssociatedTokenAccount(conn, funder, mint, buyer.publicKey);
  sig = await mintTo(conn, funder, mint, buyerAta.address, mintAuth, 50_000_000);
  console.log(`minted 50 USDC  ${ex(sig)}`);

  const b = breakdownFor(24, 1.5); // earbuds
  const inst = BigInt(b.installment), total = BigInt(b.totalOwed), merchAmt = BigInt(b.merchantAmount);
  console.log(`loan: merchant_amount ${b.merchantAmount}, total_owed ${b.totalOwed}, installment ${b.installment} (micro-USDC)`);

  const bal = async () => ({
    buyer: await tokenBalance(conn, mint, buyer.publicKey),
    vault: BigInt((await conn.getTokenAccountBalance(p.vault)).value.amount),
    merchant: await tokenBalance(conn, mint, merchant),
  });
  const start = await bal();

  // 2. create loan: init_credit + approve(3 x installment) + create_loan, buyer pays fees
  const nonce = BigInt(Date.now());
  const loanPk = p.loan(buyer.publicKey, nonce);
  sig = await sendAndConfirmTransaction(
    conn,
    new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(buyer.publicKey, ata(mint, merchant), merchant, mint),
      ixInitCredit(programId, buyer.publicKey, buyer.publicKey),
      createApproveInstruction(ata(mint, buyer.publicKey), p.pool, buyer.publicKey, inst * BigInt(3)),
      ixCreateLoan(programId, { buyer: buyer.publicKey, payer: buyer.publicKey, mint, merchant, nonce, merchantAmount: merchAmt, totalOwed: total }),
    ),
    [buyer],
  );
  console.log(`create_loan  ${ex(sig)}`);
  let now = await bal();
  check("buyer after create", now.buyer, start.buyer - inst);
  check("merchant after create (paid in full)", now.merchant, start.merchant + merchAmt);
  check("vault after create", now.vault, start.vault + inst - merchAmt);
  let loan = decodeLoan((await conn.getAccountInfo(loanPk))!.data as Buffer);
  check("loan.paid after create", loan.paid, 1);
  let credit = decodeCredit((await conn.getAccountInfo(p.credit(buyer.publicKey)))!.data as Buffer);
  check("credit.outstanding after create", credit.outstanding, total);

  // not due yet -> must fail
  try {
    await sendAndConfirmTransaction(conn, new Transaction().add(ixPayInstallment(programId, mint, loanPk, buyer.publicKey)), [buyer]);
    check("early pay_installment rejected", false, true);
  } catch (e) {
    check("early pay_installment rejected (NotDue 0x1775)", /0x1775/.test(String((e as Error).message) + JSON.stringify((e as { logs?: string[] }).logs ?? [])), true);
  }

  // 3. force due + pay installments 2..4
  for (let i = 2; i <= 4; i++) {
    sig = await sendAndConfirmTransaction(conn, new Transaction().add(ixAdminForceDue(programId, admin.publicKey, loanPk)), [admin]);
    console.log(`admin_force_due #${i}  ${ex(sig)}`);
    sig = await sendAndConfirmTransaction(conn, new Transaction().add(ixPayInstallment(programId, mint, loanPk, buyer.publicKey)), [buyer]);
    console.log(`pay_installment #${i}  ${ex(sig)}`);
    loan = decodeLoan((await conn.getAccountInfo(loanPk))!.data as Buffer);
    check(`loan.paid after installment ${i}`, loan.paid, i);
  }

  // 4. final assertions
  now = await bal();
  check("buyer final = start - total_owed", now.buyer, start.buyer - total);
  check("vault final = start + total_owed - merchant_amount", now.vault, start.vault + total - merchAmt);
  check("merchant final = start + merchant_amount", now.merchant, start.merchant + merchAmt);
  check("loan.status", loan.status, "Repaid");
  credit = decodeCredit((await conn.getAccountInfo(p.credit(buyer.publicKey)))!.data as Buffer);
  check("credit.limit (100 + 25)", credit.limit, 125_000_000);
  check("credit.outstanding", credit.outstanding, 0);
  check("credit.repaid_count", credit.repaidCount, 1);
  const acct = await getAccount(conn, ata(mint, buyer.publicKey));
  check("remaining delegation", acct.delegatedAmount, 0);

  console.log(`\n${failures === 0 ? "E2E PASSED" : `E2E FAILED (${failures} checks)`}  loan ${loanPk.toBase58()}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(`E2E ERROR: ${e instanceof Error ? e.message : e}`);
  if ((e as { logs?: string[] }).logs) console.error((e as { logs: string[] }).logs.join("\n"));
  process.exit(1);
});
