import { breakdownFor, type Breakdown, PLATFORM_FEE_BPS, INSTALLMENTS } from "../pricing";

/**
 * Display-only labels for loans (product name, item/delivery split). Balances, loans and
 * credit limits always come from chain; this only names them. Missing -> generic label.
 */
const KEY = "bipter.loanmeta.v1";
type Meta = { label: string; item: number; delivery: number };

function all(): Record<string, Meta> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveLoanMeta(id: string, label: string, b: Breakdown) {
  try {
    const m = all();
    m[id] = { label, item: b.item, delivery: b.delivery };
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Rebuild the breakdown from on-chain merchant_amount + total_owed (+ optional local label). */
export function breakdownFromChain(id: string, merchantAmount: number, totalOwed: number) {
  const meta = typeof localStorage !== "undefined" ? all()[id] : undefined;
  const splitKnown = !!meta && meta.item + meta.delivery === merchantAmount;
  const platformFee = Math.round((merchantAmount * PLATFORM_FEE_BPS) / 10_000);
  const breakdown: Breakdown = {
    ...breakdownFor(0, 0),
    item: splitKnown ? meta!.item : merchantAmount,
    delivery: splitKnown ? meta!.delivery : 0,
    platformFee,
    interest: totalOwed - merchantAmount - platformFee,
    merchantAmount,
    totalOwed,
    installment: totalOwed / INSTALLMENTS,
    payInFullTotal: merchantAmount + platformFee,
  };
  return { breakdown, splitKnown, label: meta?.label ?? `Loan ${id.slice(0, 4)}…${id.slice(-4)}` };
}
