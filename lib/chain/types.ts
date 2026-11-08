import type { Breakdown } from "../pricing";

export type ChainMode = "devnet" | "simulated";

export type LoanStatus = "Active" | "Repaid" | "Defaulted";

export type TxRecord = {
  kind: "create" | "installment" | "force_due" | "pay_in_full" | "faucet" | "sol";
  /** installment number 1..4 for create/installment */
  index?: number;
  /** real signature in devnet mode; null in simulated mode */
  sig: string | null;
  at: number; // ms
  amount: number; // micro
  /** network fee in lamports (from tx meta in devnet mode) */
  feeLamports: number | null;
};

export type Loan = {
  /** loan PDA (devnet) or local id (simulated) */
  id: string;
  buyer: string;
  merchant: string;
  label: string;
  breakdown: Breakdown;
  /** false when item/delivery split is not known (only item+delivery total is on-chain) */
  splitKnown: boolean;
  totalOwed: number; // micro
  installment: number; // micro
  paid: number; // 0..4
  nextDue: number; // ms
  status: LoanStatus;
  createdAt: number;
};

export type CreditProfile = {
  limit: number; // micro
  outstanding: number; // micro
  repaidCount: number;
  defaulted: boolean;
  /** false until the on-chain CreditProfile account is created (first loan) */
  exists: boolean;
};

export type CreateLoanInput = {
  label: string;
  productIds: string[];
  breakdown: Breakdown;
};

export interface ChainAdapter {
  mode: ChainMode;
  getBalance(): Promise<number>; // micro USDC
  getSolBalance(): Promise<number>; // lamports
  faucet(): Promise<TxRecord>;
  getSol(): Promise<TxRecord & { via: string }>;
  getCreditProfile(): Promise<CreditProfile>;
  createLoan(input: CreateLoanInput): Promise<{ loan: Loan; sig: string | null }>;
  payNextInstallment(loanId: string): Promise<{ sig: string | null }>;
  forceDue(loanId: string): Promise<{ sig: string | null }>;
  listLoans(): Promise<Loan[]>;
  getLoanTxs(loanId: string): Promise<TxRecord[]>;
  /** Plain USDC transfer to the merchant (cart "Pay in full"). */
  payInFull(amount: number, label: string): Promise<TxRecord>;
  getMerchantBalance(): Promise<number>;
  getMerchantAddress(): Promise<string>;
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`;
