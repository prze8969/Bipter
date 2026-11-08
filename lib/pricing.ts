import productsJson from "../data/products.json";

/** USDC has 6 decimals. All on-chain and internal amounts are integer micro-units. */
export const USDC_DECIMALS = 6;
export const MICRO = 1_000_000;

/** Platform fee, in basis points of (item + delivery). 100 bps = 1%. */
export const PLATFORM_FEE_BPS = 100;
/** Flat interest for the 4-payment plan, in basis points of (item + delivery). 150 bps = 1.5%. */
export const INTEREST_BPS = 150;
export const INSTALLMENTS = 4;
/** Demo interval between installments, seconds. Must match the on-chain Pool.interval_secs. */
export const INTERVAL_SECS = 60;
/** Estimated network fee: 1 signature x 5000 lamports, paid in SOL by the buyer's wallet. Real fee is read from the tx. */
export const EST_NETWORK_FEE_LAMPORTS = 5_000;

export type Product = {
  id: string;
  name: string;
  icon: string;
  item_price: number;
  delivery: number;
  ships_from: string;
  amazon_price: number | null;
  amazon_delivery: number | null;
  amazon_source_url: string | null;
  amazon_snapshot_date: string | null;
  verified: boolean;
};

export const products: Product[] = productsJson as Product[];

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export const toMicro = (usd: number) => Math.round(usd * MICRO);
export const fromMicro = (micro: number) => micro / MICRO;

export type Breakdown = {
  item: number; // micro
  delivery: number;
  platformFee: number;
  interest: number;
  /** merchant gets item + delivery, paid in full at checkout */
  merchantAmount: number;
  /** total the buyer owes for Pay in 4 (divisible by 4) */
  totalOwed: number;
  installment: number;
  /** total for Pay in full (no interest) */
  payInFullTotal: number;
};

function bps(amount: number, b: number) {
  return Math.round((amount * b) / 10_000);
}

export function breakdownFor(itemUsd: number, deliveryUsd: number, qty = 1): Breakdown {
  const item = toMicro(itemUsd) * qty;
  const delivery = toMicro(deliveryUsd) * qty;
  const base = item + delivery;
  const platformFee = bps(base, PLATFORM_FEE_BPS);
  let interest = bps(base, INTEREST_BPS);
  let totalOwed = base + platformFee + interest;
  // total_owed must be divisible by 4; any rounding goes into interest so the breakdown always sums.
  const rem = totalOwed % INSTALLMENTS;
  if (rem !== 0) {
    interest += INSTALLMENTS - rem;
    totalOwed += INSTALLMENTS - rem;
  }
  return {
    item,
    delivery,
    platformFee,
    interest,
    merchantAmount: base,
    totalOwed,
    installment: totalOwed / INSTALLMENTS,
    payInFullTotal: base + platformFee,
  };
}

export function productBreakdown(p: Product, qty = 1) {
  return breakdownFor(p.item_price, p.delivery, qty);
}

/** Amazon total in micro-units, or null when the snapshot is not verified / incomplete. */
export function amazonTotal(p: Product): number | null {
  if (!p.verified || p.amazon_price == null || p.amazon_delivery == null) return null;
  return toMicro(p.amazon_price) + toMicro(p.amazon_delivery);
}

/** Savings vs Amazon (micro), using the Pay in 4 total. Null when not verified. */
export function savingsVsAmazon(p: Product): number | null {
  const a = amazonTotal(p);
  if (a == null) return null;
  return a - productBreakdown(p).totalOwed;
}

export function formatUsdc(micro: number) {
  return (micro / MICRO).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
