import { Keypair, type PublicKey } from "@solana/web3.js";
import { EST_NETWORK_FEE_LAMPORTS, INSTALLMENTS, INTERVAL_SECS, MICRO } from "../pricing";

/** LOCAL DEVELOPMENT ONLY (NEXT_PUBLIC_CHAIN_MODE=simulated). Never used in devnet mode. */
import type { ChainAdapter, CreateLoanInput, CreditProfile, Loan, TxRecord } from "./types";

/** Same rules as program/lib.rs, kept in memory + localStorage. No real transactions. */

const STATE_KEY = "bipter.sim.v2";
const START_LIMIT = 100 * MICRO;
const LIMIT_STEP = 25 * MICRO;
const FAUCET_AMOUNT = 100 * MICRO;

type SimState = {
  balance: number;
  merchantBalance: number;
  vault: number;
  merchant: string;
  credit: CreditProfile;
  loans: (Loan & { txs: TxRecord[] })[];
  sol: number;
};

function freshState(): SimState {
  return {
    balance: 0,
    merchantBalance: 0,
    vault: 0,
    merchant: Keypair.generate().publicKey.toBase58(),
    credit: { limit: START_LIMIT, outstanding: 0, repaidCount: 0, defaulted: false, exists: true },
    loans: [],
    sol: 0,
  };
}

let memory: SimState | null = null;

function load(): SimState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) memory = JSON.parse(raw) as SimState;
  } catch {
    /* ignore */
  }
  if (!memory) memory = freshState();
  return memory;
}

function save(s: SimState) {
  memory = s;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const tx = (kind: TxRecord["kind"], amount: number, index?: number): TxRecord => ({
  kind,
  index,
  sig: null,
  at: Date.now(),
  amount,
  feeLamports: EST_NETWORK_FEE_LAMPORTS,
});

export function resetSimulated() {
  memory = null;
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

export function createSimulatedAdapter(wallet: PublicKey | null): ChainAdapter {
  const me = () => {
    if (!wallet) throw new Error("Connect a wallet first");
    return wallet.toBase58();
  };
  return {
  mode: "simulated",

  async getSolBalance() {
    me();
    return load().sol;
  },

  async getSol() {
    me();
    const s = load();
    s.sol += 1_000_000_000;
    save(s);
    return { ...tx("sol", 0), via: "simulated" };
  },

  async getBalance() {
    me();
    return load().balance;
  },

  async faucet() {
    const s = load();
    s.balance += FAUCET_AMOUNT;
    save(s);
    return tx("faucet", FAUCET_AMOUNT);
  },

  async getCreditProfile() {
    return { ...load().credit };
  },

  async createLoan(input: CreateLoanInput) {
    const s = load();
    const { breakdown } = input;
    if (breakdown.totalOwed % INSTALLMENTS !== 0) throw new Error("total_owed must be divisible by 4");
    if (s.credit.defaulted) throw new Error("Credit profile is defaulted");
    if (s.credit.outstanding + breakdown.totalOwed > s.credit.limit)
      throw new Error("Over credit limit");
    if (s.balance < breakdown.installment) throw new Error("Not enough USDC for the first installment");
    if (s.vault < breakdown.merchantAmount) {
      // simulated pool has deep liquidity; top it up like setup-devnet seeds it
      s.vault += 1_000 * MICRO;
    }
    const now = Date.now();
    // installment 1 -> vault; vault -> merchant (full item + delivery)
    s.balance -= breakdown.installment;
    s.vault += breakdown.installment;
    s.vault -= breakdown.merchantAmount;
    s.merchantBalance += breakdown.merchantAmount;
    s.credit.outstanding += breakdown.totalOwed;

    const buyer = me();
    const loan: Loan & { txs: TxRecord[] } = {
      id: `sim-${now.toString(36)}`,
      buyer,
      merchant: s.merchant,
      label: input.label,
      breakdown,
      splitKnown: true,
      totalOwed: breakdown.totalOwed,
      installment: breakdown.installment,
      paid: 1,
      nextDue: now + INTERVAL_SECS * 1000,
      status: "Active",
      createdAt: now,
      txs: [tx("create", breakdown.installment, 1)],
    };
    s.loans.unshift(loan);
    save(s);
    return { loan, sig: null };
  },

  async payNextInstallment(loanId) {
    const s = load();
    const loan = s.loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "Active") throw new Error(`Loan is ${loan.status}`);
    if (Date.now() < loan.nextDue) throw new Error("Not due yet");
    if (s.balance < loan.installment) throw new Error("Buyer has not enough USDC (delegated pull would fail)");
    s.balance -= loan.installment;
    s.vault += loan.installment;
    loan.paid += 1;
    loan.nextDue += INTERVAL_SECS * 1000;
    loan.txs.push(tx("installment", loan.installment, loan.paid));
    if (loan.paid === INSTALLMENTS) {
      loan.status = "Repaid";
      s.credit.limit += LIMIT_STEP;
      s.credit.outstanding -= loan.totalOwed;
      s.credit.repaidCount += 1;
    }
    save(s);
    return { sig: null };
  },

  async forceDue(loanId) {
    const s = load();
    const loan = s.loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "Active") throw new Error(`Loan is ${loan.status}`);
    loan.nextDue = Date.now();
    save(s);
    return { sig: null };
  },

  async listLoans() {
    return load().loans.map((l) => ({ ...l }));
  },

  async getLoanTxs(loanId) {
    return load().loans.find((l) => l.id === loanId)?.txs ?? [];
  },

  async payInFull(amount) {
    const s = load();
    if (s.balance < amount) throw new Error("Not enough USDC");
    s.balance -= amount;
    s.merchantBalance += amount;
    save(s);
    return tx("pay_in_full", amount);
  },

  async getMerchantBalance() {
    return load().merchantBalance;
  },

  async getMerchantAddress() {
    return load().merchant;
  },
  };
}
