import type { Breakdown } from "../pricing";

export type ChainMode = "devnet" | "simulated";

export type LoanStatus = "Active" | "Repaid" | "Defaulted";

export type TxRecord = {
  kind: "create" | "installment" | "pay_in_full" | "faucet";
  /** installment number 1..4 for create/installment */
  index?: number;
  /** real signature in devnet mode; null in simulated mode */
  sig: string | null;
  at: number; // ms
  amount: number; // micro
  /** network fee in lamports, real from tx meta in devnet mode, estimate in simulated */
  feeLamports: number | null;
};

export type Loan = {
  id: string;
  buyer: string;
  merchant: string;
  label: string;
  productIds: string[];
  breakdown: Breakdown;
  totalOwed: number; // micro
  installment: number; // micro
  paid: number; // 0..4
  nextDue: number; // ms
  status: LoanStatus;
  createdAt: number;
  txs: TxRecord[];
};

export type CreditProfile = {
  limit: number; // micro
  outstanding: number; // micro
  repaidCount: number;
  defaulted: boolean;
};

export type CreateLoanInput = {
  label: string;
  productIds: string[];
  breakdown: Breakdown;
};

export interface ChainAdapter {
  mode: ChainMode;
  getWallet(): Promise<string>;
  getBalance(): Promise<number>; // micro USDC
  faucet(): Promise<TxRecord>;
  getCreditProfile(): Promise<CreditProfile>;
  createLoan(input: CreateLoanInput): Promise<Loan>;
  payNextInstallment(loanId: string): Promise<Loan>;
  forceDue(loanId: string): Promise<Loan>;
  listLoans(): Promise<Loan[]>;
  /** Plain USDC transfer to the merchant (cart "Pay in full"). */
  payInFull(amount: number, label: string): Promise<TxRecord>;
  getMerchantBalance(): Promise<number>;
  getMerchantAddress(): Promise<string>;
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (addr: string) => `https://explorer.solana.com/address/${addr}?cluster=devnet`;
