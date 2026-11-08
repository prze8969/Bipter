/**
 * Minimal client for program/lib.rs without depending on an IDL file.
 * Discriminators = sha256("global:<ix>")[0..8] / sha256("account:<Name>")[0..8] (Anchor convention).
 * Account metas follow the order of each #[derive(Accounts)] struct in lib.rs.
 * Shared by the browser adapter and the node scripts.
 */
import { PublicKey, SystemProgram, TransactionInstruction, type Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

const IX = {
  init_pool: [116, 233, 199, 204, 115, 159, 171, 36],
  init_lp: [90, 134, 130, 76, 50, 225, 21, 142],
  deposit: [242, 35, 198, 137, 82, 225, 242, 182],
  init_credit: [59, 189, 248, 66, 21, 220, 162, 52],
  create_loan: [166, 131, 118, 219, 138, 218, 206, 140],
  pay_installment: [214, 118, 104, 215, 242, 93, 33, 60],
  admin_force_due: [172, 186, 233, 65, 239, 35, 27, 52],
  mark_default: [182, 231, 123, 132, 66, 208, 137, 139],
} as const;

const ACC = {
  Pool: [241, 154, 109, 4, 17, 177, 109, 188],
  CreditProfile: [155, 31, 253, 22, 211, 62, 131, 148],
  Loan: [20, 195, 70, 117, 165, 227, 182, 1],
} as const;

export const POOL_SIZE = 8 + 32 * 3 + 8 + 8 + 8 + 1;
export const CREDIT_SIZE = 8 + 32 + 8 + 8 + 4 + 1 + 1;
export const LOAN_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 1;

/* ---------------- encoding ---------------- */

function u64(n: bigint | number) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}
function i64(n: bigint | number) {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
}
const disc = (d: readonly number[]) => Buffer.from(d);
const w = (pubkey: PublicKey, isSigner = false) => ({ pubkey, isSigner, isWritable: true });
const r = (pubkey: PublicKey, isSigner = false) => ({ pubkey, isSigner, isWritable: false });

/* ---------------- PDAs ---------------- */

export function pdas(programId: PublicKey) {
  const find = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  return {
    pool: find([Buffer.from("pool")]),
    vault: find([Buffer.from("vault")]),
    credit: (buyer: PublicKey) => find([Buffer.from("credit"), buyer.toBuffer()]),
    loan: (buyer: PublicKey, nonce: bigint) => find([Buffer.from("loan"), buyer.toBuffer(), u64(nonce)]),
    lp: (owner: PublicKey) => find([Buffer.from("lp"), owner.toBuffer()]),
  };
}

export const ata = (mint: PublicKey, owner: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

/* ---------------- instructions ---------------- */

export function ixInitPool(programId: PublicKey, admin: PublicKey, mint: PublicKey, intervalSecs: number, graceSecs: number) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [w(admin, true), r(mint), w(p.pool), w(p.vault), r(TOKEN_PROGRAM_ID), r(SystemProgram.programId)],
    data: Buffer.concat([disc(IX.init_pool), i64(intervalSecs), i64(graceSecs)]),
  });
}

export function ixInitLp(programId: PublicKey, owner: PublicKey, payer: PublicKey) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [r(owner, true), w(payer, true), w(p.lp(owner)), r(SystemProgram.programId)],
    data: disc(IX.init_lp),
  });
}

export function ixDeposit(programId: PublicKey, owner: PublicKey, ownerToken: PublicKey, amount: bigint) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [r(owner, true), w(p.pool), w(p.vault), w(ownerToken), w(p.lp(owner)), r(TOKEN_PROGRAM_ID)],
    data: Buffer.concat([disc(IX.deposit), u64(amount)]),
  });
}

export function ixInitCredit(programId: PublicKey, buyer: PublicKey, payer: PublicKey) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [r(buyer), w(payer, true), w(p.credit(buyer)), r(SystemProgram.programId)],
    data: disc(IX.init_credit),
  });
}

export function ixCreateLoan(
  programId: PublicKey,
  a: { buyer: PublicKey; payer: PublicKey; mint: PublicKey; merchant: PublicKey; nonce: bigint; merchantAmount: bigint; totalOwed: bigint },
) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [
      r(a.buyer, true),
      w(a.payer, true),
      r(p.pool),
      w(p.vault),
      w(p.credit(a.buyer)),
      w(p.loan(a.buyer, a.nonce)),
      w(ata(a.mint, a.buyer)),
      w(ata(a.mint, a.merchant)),
      r(TOKEN_PROGRAM_ID),
      r(SystemProgram.programId),
    ],
    data: Buffer.concat([disc(IX.create_loan), u64(a.nonce), u64(a.merchantAmount), u64(a.totalOwed)]),
  });
}

export function ixPayInstallment(programId: PublicKey, mint: PublicKey, loan: PublicKey, buyer: PublicKey) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [r(p.pool), w(p.vault), w(loan), w(p.credit(buyer)), w(ata(mint, buyer)), r(TOKEN_PROGRAM_ID)],
    data: disc(IX.pay_installment),
  });
}

export function ixAdminForceDue(programId: PublicKey, admin: PublicKey, loan: PublicKey) {
  const p = pdas(programId);
  return new TransactionInstruction({
    programId,
    keys: [r(admin, true), r(p.pool), w(loan)],
    data: disc(IX.admin_force_due),
  });
}

export { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID };

/* ---------------- decoding ---------------- */

function checkDisc(data: Buffer, d: readonly number[], name: string) {
  for (let i = 0; i < 8; i++) if (data[i] !== d[i]) throw new Error(`Not a ${name} account`);
}

export type PoolAcc = { admin: PublicKey; mint: PublicKey; vault: PublicKey; intervalSecs: number; graceSecs: number; totalDeposited: bigint };
export function decodePool(data: Buffer): PoolAcc {
  checkDisc(data, ACC.Pool, "Pool");
  let o = 8;
  const pk = () => new PublicKey(data.subarray(o, (o += 32)));
  const admin = pk(), mint = pk(), vault = pk();
  const intervalSecs = Number(data.readBigInt64LE(o)); o += 8;
  const graceSecs = Number(data.readBigInt64LE(o)); o += 8;
  const totalDeposited = data.readBigUInt64LE(o);
  return { admin, mint, vault, intervalSecs, graceSecs, totalDeposited };
}

export type CreditAcc = { buyer: PublicKey; limit: bigint; outstanding: bigint; repaidCount: number; defaulted: boolean };
export function decodeCredit(data: Buffer): CreditAcc {
  checkDisc(data, ACC.CreditProfile, "CreditProfile");
  let o = 8;
  const buyer = new PublicKey(data.subarray(o, (o += 32)));
  const limit = data.readBigUInt64LE(o); o += 8;
  const outstanding = data.readBigUInt64LE(o); o += 8;
  const repaidCount = data.readUInt32LE(o); o += 4;
  const defaulted = data[o] === 1;
  return { buyer, limit, outstanding, repaidCount, defaulted };
}

export type LoanAcc = {
  buyer: PublicKey; merchant: PublicKey; nonce: bigint; merchantAmount: bigint; totalOwed: bigint; installment: bigint;
  paid: number; nextDue: number; createdAt: number; status: "Active" | "Repaid" | "Defaulted";
};
export function decodeLoan(data: Buffer): LoanAcc {
  checkDisc(data, ACC.Loan, "Loan");
  let o = 8;
  const pk = () => new PublicKey(data.subarray(o, (o += 32)));
  const buyer = pk(), merchant = pk();
  const nonce = data.readBigUInt64LE(o); o += 8;
  const merchantAmount = data.readBigUInt64LE(o); o += 8;
  const totalOwed = data.readBigUInt64LE(o); o += 8;
  const installment = data.readBigUInt64LE(o); o += 8;
  const paid = data[o]; o += 1;
  const nextDue = Number(data.readBigInt64LE(o)); o += 8;
  const createdAt = Number(data.readBigInt64LE(o)); o += 8;
  const status = (["Active", "Repaid", "Defaulted"] as const)[data[o]];
  return { buyer, merchant, nonce, merchantAmount, totalOwed, installment, paid, nextDue, createdAt, status };
}

/** All loans of a buyer: filter by account size and the buyer field at offset 8. */
export async function fetchLoans(connection: Connection, programId: PublicKey, buyer: PublicKey) {
  const accs = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: LOAN_SIZE }, { memcmp: { offset: 8, bytes: buyer.toBase58() } }],
  });
  return accs.map((a) => ({ pubkey: a.pubkey, loan: decodeLoan(a.account.data as Buffer) }));
}

/** Token balance in micro-units; 0 if the ATA does not exist yet. */
export async function tokenBalance(connection: Connection, mint: PublicKey, owner: PublicKey): Promise<bigint> {
  try {
    const b = await connection.getTokenAccountBalance(ata(mint, owner));
    return BigInt(b.value.amount);
  } catch {
    return BigInt(0);
  }
}
