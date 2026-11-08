"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAdapter, CHAIN_MODE, type ChainAdapter, type CreditProfile, type Loan } from "@/lib/chain";
import { detectCurrency, fetchRates, FALLBACK_RATES, formatMoney, SUPPORTED, type CurrencyCode, type Rates } from "@/lib/currency";
import { MICRO } from "@/lib/pricing";

/* ---------------- chain ---------------- */

type ChainState = {
  adapter: ChainAdapter;
  mode: typeof CHAIN_MODE;
  ready: boolean;
  wallet: string | null;
  balance: number;
  credit: CreditProfile | null;
  loans: Loan[];
  merchantBalance: number;
  error: string | null;
  refresh: () => Promise<void>;
};

const ChainCtx = createContext<ChainState | null>(null);

/* ---------------- currency ---------------- */

type CurrencyState = {
  code: CurrencyCode;
  setCode: (c: CurrencyCode) => void;
  rates: Rates;
  /** format micro-USDC in the display currency */
  fmt: (micro: number) => string;
};

const CurrencyCtx = createContext<CurrencyState | null>(null);

/* ---------------- cart ---------------- */

export type CartPlan = "full" | "pay4";
export type CartLine = { productId: string; qty: number; plan: CartPlan };

type CartState = {
  lines: CartLine[];
  count: number;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setPlan: (productId: string, plan: CartPlan) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
};

const CartCtx = createContext<CartState | null>(null);

const CART_KEY = "bipter.cart.v1";
const CUR_KEY = "bipter.currency.v1";

export function Providers({ children }: { children: React.ReactNode }) {
  const adapter = useMemo(() => getAdapter(), []);

  /* chain */
  const [ready, setReady] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [credit, setCredit] = useState<CreditProfile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [merchantBalance, setMerchantBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [w, b, c, l, m] = await Promise.all([
        adapter.getWallet(),
        adapter.getBalance(),
        adapter.getCreditProfile(),
        adapter.listLoans(),
        adapter.getMerchantBalance(),
      ]);
      setWallet(w);
      setBalance(b);
      setCredit(c);
      setLoans(l);
      setMerchantBalance(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [adapter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* currency */
  const [code, setCodeState] = useState<CurrencyCode>("USD");
  const [rates, setRates] = useState<Rates>({ rates: FALLBACK_RATES, source: "fallback", asOf: null });
  // fixed locale for SSR + first client render, then the visitor's locale (avoids hydration mismatch)
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(CUR_KEY);
    } catch {
      /* ignore */
    }
    setCodeState(saved && (SUPPORTED as readonly string[]).includes(saved) ? (saved as CurrencyCode) : detectCurrency());
    setLocale(navigator.language || "en-US");
    fetchRates().then(setRates);
  }, []);

  const setCode = useCallback((c: CurrencyCode) => {
    setCodeState(c);
    try {
      localStorage.setItem(CUR_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const fmt = useCallback((micro: number) => formatMoney(micro / MICRO, code, rates.rates[code], locale), [code, rates, locale]);

  /* cart */
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const persist = useCallback((next: CartLine[]) => {
    setLines(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const cart: CartState = useMemo(
    () => ({
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      add: (productId) => {
        const found = lines.find((l) => l.productId === productId);
        persist(
          found
            ? lines.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l))
            : [...lines, { productId, qty: 1, plan: "pay4" }],
        );
      },
      remove: (productId) => persist(lines.filter((l) => l.productId !== productId)),
      setPlan: (productId, plan) => persist(lines.map((l) => (l.productId === productId ? { ...l, plan } : l))),
      setQty: (productId, qty) =>
        persist(lines.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, Math.min(9, qty)) } : l))),
      clear: () => persist([]),
    }),
    [lines, persist],
  );

  const chain: ChainState = {
    adapter,
    mode: CHAIN_MODE,
    ready,
    wallet,
    balance,
    credit,
    loans,
    merchantBalance,
    error,
    refresh,
  };

  return (
    <ChainCtx.Provider value={chain}>
      <CurrencyCtx.Provider value={{ code, setCode, rates, fmt }}>
        <CartCtx.Provider value={cart}>{children}</CartCtx.Provider>
      </CurrencyCtx.Provider>
    </ChainCtx.Provider>
  );
}

export function useChain() {
  const c = useContext(ChainCtx);
  if (!c) throw new Error("useChain outside Providers");
  return c;
}
export function useCurrency() {
  const c = useContext(CurrencyCtx);
  if (!c) throw new Error("useCurrency outside Providers");
  return c;
}
export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside Providers");
  return c;
}
