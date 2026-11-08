"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { CHAIN_MODE, RPC_URL, missingConfig, type ChainAdapter, type CreditProfile, type Loan } from "@/lib/chain";
import { createDevnetAdapter } from "@/lib/chain/devnet";
import { createSimulatedAdapter } from "@/lib/chain/simulated";
import { detectCurrency, fetchRates, FALLBACK_RATES, formatMoney, SUPPORTED, type CurrencyCode, type Rates } from "@/lib/currency";
import { MICRO, formatUsdc } from "@/lib/pricing";

import "@solana/wallet-adapter-react-ui/styles.css";

/* ---------------- chain ---------------- */

type ChainState = {
  adapter: ChainAdapter;
  mode: typeof CHAIN_MODE;
  connected: boolean;
  wallet: string | null;
  ready: boolean;
  usdc: number; // micro
  sol: number; // lamports
  credit: CreditProfile | null;
  loans: Loan[];
  merchantBalance: number;
  error: string | null;
  missing: string[];
  refresh: () => Promise<void>;
};

const ChainCtx = createContext<ChainState | null>(null);

/* ---------------- currency ---------------- */

type CurrencyState = {
  code: CurrencyCode;
  setCode: (c: CurrencyCode) => void;
  rates: Rates;
  /** primary format: USDC */
  fmt: (micro: number) => string;
  /** small display-only local-currency line, e.g. "≈ ₹4,582" (empty when USD) */
  local: (micro: number) => string;
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

/* ---------------- theme ---------------- */

export type Theme = "light" | "dark";
type ThemeState = { theme: Theme; toggle: () => void };
const ThemeCtx = createContext<ThemeState | null>(null);
export const THEME_KEY = "bipter.theme";

const CART_KEY = "bipter.cart.v1";
const CUR_KEY = "bipter.currency.v1";

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet })],
    [],
  );
  return (
    <ThemeProvider>
      <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <AppState>{children}</AppState>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

function AppState({ children }: { children: React.ReactNode }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction } = wallet;

  const adapter = useMemo(
    () =>
      CHAIN_MODE === "simulated"
        ? createSimulatedAdapter(publicKey)
        : createDevnetAdapter(connection, { publicKey, sendTransaction }),
    [connection, publicKey, sendTransaction],
  );
  const missing = useMemo(() => (CHAIN_MODE === "devnet" ? missingConfig() : []), []);

  /* chain */
  const [ready, setReady] = useState(false);
  const [usdc, setUsdc] = useState(0);
  const [sol, setSol] = useState(0);
  const [credit, setCredit] = useState<CreditProfile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [merchantBalance, setMerchantBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setUsdc(0);
      setSol(0);
      setCredit(null);
      setLoans([]);
      setReady(true);
      return;
    }
    if (missing.length) {
      setError(`Devnet config missing: ${missing.join(", ")}`);
      setReady(true);
      return;
    }
    try {
      const [b, s, c, l, m] = await Promise.all([
        adapter.getBalance(),
        adapter.getSolBalance(),
        adapter.getCreditProfile(),
        adapter.listLoans(),
        adapter.getMerchantBalance(),
      ]);
      setUsdc(b);
      setSol(s);
      setCredit(c);
      setLoans(l);
      setMerchantBalance(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReady(true);
    }
  }, [adapter, publicKey, missing]);

  useEffect(() => {
    setReady(false);
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

  const fmt = useCallback((micro: number) => `${formatUsdc(micro)} USDC`, []);
  const local = useCallback(
    (micro: number) => (code === "USD" ? "" : `≈ ${formatMoney(micro / MICRO, code, rates.rates[code], locale)}`),
    [code, rates, locale],
  );

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
    connected: !!publicKey,
    wallet: publicKey?.toBase58() ?? null,
    ready,
    usdc,
    sol,
    credit,
    loans,
    merchantBalance,
    error,
    missing,
    refresh,
  };

  return (
    <ChainCtx.Provider value={chain}>
      <CurrencyCtx.Provider value={{ code, setCode, rates, fmt, local }}>
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
export function useTheme() {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useTheme outside Providers");
  return c;
}
