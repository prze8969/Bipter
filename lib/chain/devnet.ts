import { LAMPORTS_PER_SOL, PublicKey, Transaction, type Connection, type TransactionInstruction } from "@solana/web3.js";
import {
  createApproveInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { INSTALLMENTS, USDC_DECIMALS } from "../pricing";
import { MERCHANT, PROGRAM_ID, USDC_MINT, missingConfig } from "./config";
import { breakdownFromChain, saveLoanMeta } from "./meta";
import {
  ata, decodeCredit, fetchLoans, ixCreateLoan, ixInitCredit, ixPayInstallment, pdas, tokenBalance, decodeLoan,
} from "./program";
import type { ChainAdapter, CreditProfile, Loan, TxRecord } from "./types";

const START_LIMIT = 100_000_000;

const PROGRAM_ERRORS: Record<number, string> = {
  6000: "Bad parameters",
  6001: "total_owed must be divisible by 4",
  6002: "Credit profile is defaulted",
  6003: "Over credit limit",
  6004: "Loan is not active",
  6005: "Installment not due yet",
  6006: "Grace period not over",
  6007: "Arithmetic overflow",
};

export function friendlyError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const hex = msg.match(/custom program error: 0x([0-9a-f]+)/i);
  if (hex) {
    const code = parseInt(hex[1], 16);
    if (PROGRAM_ERRORS[code]) return new Error(PROGRAM_ERRORS[code]);
    if (code === 1) return new Error("Insufficient USDC balance");
  }
  if (/insufficient lamports|insufficient funds for fee|Attempt to debit an account but found no record/i.test(msg))
    return new Error("Not enough devnet SOL for network fees. Use “Get devnet SOL”.");
  if (/User rejected|rejected the request/i.test(msg)) return new Error("Transaction rejected in wallet");
  if (/Snap .*terminated|solana-wallet-snap/i.test(msg))
    return new Error("MetaMask's Solana snap crashed while signing. Nothing was charged. Try again, or use Phantom / Solflare (more reliable on devnet).");
  return e instanceof Error ? e : new Error(msg);
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `${url} failed (${res.status})`);
  return json;
}

type Wallet = Pick<WalletContextState, "publicKey" | "sendTransaction"> & Partial<Pick<WalletContextState, "signTransaction">>;

export function createDevnetAdapter(connection: Connection, wallet: Wallet): ChainAdapter {
  const cfg = () => {
    const missing = missingConfig();
    if (missing.length) throw new Error(`Devnet config missing: ${missing.join(", ")}`);
    return { programId: PROGRAM_ID!, mint: USDC_MINT!, merchant: MERCHANT! };
  };
  const me = () => {
    if (!wallet.publicKey) throw new Error("Connect a wallet first");
    return wallet.publicKey;
  };

  async function send(ixs: TransactionInstruction[]) {
    const payer = me();
    const tx = new Transaction().add(...ixs);
    tx.feePayer = payer;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    try {
      // Prefer sign-only: the wallet just signs, the app broadcasts. Less work inside the wallet
      // (MetaMask's Solana snap has crashed on sign-and-send), and preflight errors come back with program logs.
      let sig: string;
      if (wallet.signTransaction) {
        const signed = await wallet.signTransaction(tx);
        sig = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed", maxRetries: 3 });
      } else {
        sig = await wallet.sendTransaction(tx, connection);
      }
      const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (conf.value.err) throw new Error(`Transaction failed: ${JSON.stringify(conf.value.err)}`);
      return sig;
    } catch (e) {
      throw friendlyError(e);
    }
  }

  async function feeOf(sig: string): Promise<number | null> {
    try {
      const t = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      return t?.meta?.fee ?? null;
    } catch {
      return null;
    }
  }

  async function myLoans(): Promise<Loan[]> {
    const { programId } = cfg();
    const rows = await fetchLoans(connection, programId, me());
    return rows
      .map(({ pubkey, loan }) => {
        const id = pubkey.toBase58();
        const merchantAmount = Number(loan.merchantAmount);
        const totalOwed = Number(loan.totalOwed);
        const { breakdown, splitKnown, label } = breakdownFromChain(id, merchantAmount, totalOwed);
        return {
          id,
          buyer: loan.buyer.toBase58(),
          merchant: loan.merchant.toBase58(),
          label,
          breakdown,
          splitKnown,
          totalOwed,
          installment: Number(loan.installment),
          paid: loan.paid,
          nextDue: loan.nextDue * 1000,
          status: loan.status,
          createdAt: loan.createdAt * 1000,
        } satisfies Loan;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  return {
    mode: "devnet",

    async getBalance() {
      const { mint } = cfg();
      return Number(await tokenBalance(connection, mint, me()));
    },

    async getSolBalance() {
      return connection.getBalance(me(), "confirmed");
    },

    async faucet() {
      const j = await postJson("/api/faucet", { wallet: me().toBase58() });
      return { kind: "faucet", sig: j.sig, at: Date.now(), amount: j.amount, feeLamports: null };
    },

    async getSol() {
      const j = await postJson("/api/sol", { wallet: me().toBase58() });
      return { kind: "sol", sig: j.sig, at: Date.now(), amount: 0, feeLamports: null, via: j.via };
    },

    async getCreditProfile(): Promise<CreditProfile> {
      const { programId } = cfg();
      const info = await connection.getAccountInfo(pdas(programId).credit(me()), "confirmed");
      if (!info) return { limit: START_LIMIT, outstanding: 0, repaidCount: 0, defaulted: false, exists: false };
      const c = decodeCredit(info.data as Buffer);
      return { limit: Number(c.limit), outstanding: Number(c.outstanding), repaidCount: c.repaidCount, defaulted: c.defaulted, exists: true };
    },

    async createLoan(input) {
      const { programId, mint, merchant } = cfg();
      const buyer = me();
      const p = pdas(programId);
      const b = input.breakdown;
      if (b.totalOwed % INSTALLMENTS !== 0) throw new Error("total_owed must be divisible by 4");

      const ixs: TransactionInstruction[] = [
        createAssociatedTokenAccountIdempotentInstruction(buyer, ata(mint, buyer), buyer, mint),
        createAssociatedTokenAccountIdempotentInstruction(buyer, ata(mint, merchant), merchant, mint),
      ];
      const credit = await connection.getAccountInfo(p.credit(buyer), "confirmed");
      if (!credit) ixs.push(ixInitCredit(programId, buyer, buyer));

      // `approve` replaces any previous delegation, so cap it at everything still owed on
      // active loans plus 3 installments of the new loan.
      const active = (await myLoans()).filter((l) => l.status === "Active");
      const stillOwed = active.reduce((s, l) => s + l.installment * (INSTALLMENTS - l.paid), 0);
      const cap = BigInt(stillOwed + 3 * b.installment);
      ixs.push(createApproveInstruction(ata(mint, buyer), p.pool, buyer, cap));

      const nonce = BigInt(Date.now());
      ixs.push(
        ixCreateLoan(programId, {
          buyer, payer: buyer, mint, merchant, nonce,
          merchantAmount: BigInt(b.merchantAmount),
          totalOwed: BigInt(b.totalOwed),
        }),
      );
      const sig = await send(ixs);
      const loanPda = p.loan(buyer, nonce).toBase58();
      saveLoanMeta(loanPda, input.label, b);
      const loan = (await myLoans()).find((l) => l.id === loanPda);
      if (!loan) throw new Error(`Loan created (tx ${sig}) but not found yet; refresh in a moment.`);
      return { loan, sig };
    },

    async payNextInstallment(loanId) {
      const { programId, mint } = cfg();
      const loanPk = new PublicKey(loanId);
      const info = await connection.getAccountInfo(loanPk, "confirmed");
      if (!info) throw new Error("Loan not found on-chain");
      const loan = decodeLoan(info.data as Buffer);
      const sig = await send([ixPayInstallment(programId, mint, loanPk, loan.buyer)]);
      return { sig };
    },

    async forceDue(loanId) {
      const j = await postJson("/api/admin/force-due", { loan: loanId });
      return { sig: j.sig };
    },

    listLoans: myLoans,

    async getLoanTxs(loanId) {
      const sigs = await connection.getSignaturesForAddress(new PublicKey(loanId), { limit: 50 }, "confirmed");
      const ok = sigs.filter((s) => !s.err);
      if (!ok.length) return [];
      const txs = await connection.getParsedTransactions(ok.map((s) => s.signature), { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      // RPC order is not reliably chronological: classify, then sort by slot (create first on ties).
      const rank = { create: 0, force_due: 1, installment: 2 } as const;
      const rows: (TxRecord & { slot: number })[] = [];
      txs.forEach((t, i) => {
        const logs = t?.meta?.logMessages ?? [];
        const kind = logs.some((l) => l.includes("Instruction: CreateLoan"))
          ? "create"
          : logs.some((l) => l.includes("Instruction: PayInstallment"))
            ? "installment"
            : logs.some((l) => l.includes("Instruction: AdminForceDue"))
              ? "force_due"
              : null;
        if (!kind) return;
        rows.push({
          kind, sig: ok[i].signature, slot: t?.slot ?? ok[i].slot,
          at: (t?.blockTime ?? ok[i].blockTime ?? 0) * 1000, amount: 0, feeLamports: t?.meta?.fee ?? null,
        });
      });
      rows.sort((a, b) => a.slot - b.slot || rank[a.kind as keyof typeof rank] - rank[b.kind as keyof typeof rank]);
      let next = 2;
      return rows.map(({ slot: _slot, ...r }) => {
        void _slot;
        return r.kind === "create" ? { ...r, index: 1 } : r.kind === "installment" ? { ...r, index: next++ } : r;
      });
    },

    async payInFull(amount) {
      const { mint, merchant } = cfg();
      const buyer = me();
      const sig = await send([
        createAssociatedTokenAccountIdempotentInstruction(buyer, ata(mint, merchant), merchant, mint),
        createTransferCheckedInstruction(ata(mint, buyer), mint, ata(mint, merchant), buyer, BigInt(amount), USDC_DECIMALS),
      ]);
      return { kind: "pay_in_full", sig, at: Date.now(), amount, feeLamports: await feeOf(sig) };
    },

    async getMerchantBalance() {
      const { mint, merchant } = cfg();
      return Number(await tokenBalance(connection, mint, merchant));
    },

    async getMerchantAddress() {
      return cfg().merchant.toBase58();
    },
  };
}

export const SOL = LAMPORTS_PER_SOL;
