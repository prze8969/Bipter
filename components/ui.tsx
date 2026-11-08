"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Backpack, Cable, GlassWater, Headphones, Keyboard, Package, PlugZap, ShoppingBag, Smartphone, type LucideIcon,
} from "lucide-react";
import { useCart, useChain, useCurrency } from "./providers";
import { SUPPORTED, type CurrencyCode } from "@/lib/currency";

const ICONS: Record<string, LucideIcon> = { Backpack, Cable, GlassWater, Headphones, Keyboard, PlugZap, Smartphone };

export function ProductIcon({ name, size = 28 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Package;
  return <Icon size={size} strokeWidth={1.5} />;
}

export function ModeBadge() {
  const { mode } = useChain();
  const devnet = mode === "devnet";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        devnet ? "border-ok/30 text-ok" : "border-line text-muted"
      }`}
      title={devnet ? "Real Solana devnet program" : "Simulated in your browser. No transactions are sent."}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${devnet ? "bg-ok" : "bg-muted"}`} />
      {devnet ? "Devnet" : "Simulated"}
    </span>
  );
}

export function Nav() {
  const path = usePathname();
  const { count } = useCart();
  const items = [
    { href: "/", label: "Dashboard" },
    { href: "/store", label: "Store" },
    { href: "/cart", label: count ? `Cart (${count})` : "Cart" },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white">
            <ShoppingBag size={16} strokeWidth={2} />
          </span>
          Bipter
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {items.map((it) => {
            const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`rounded-lg px-2.5 py-1.5 transition-colors ${active ? "bg-fg text-white" : "text-muted hover:text-fg"}`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden sm:block">
          <ModeBadge />
        </div>
      </div>
      <div className="mx-auto -mt-2 flex max-w-5xl justify-end px-4 pb-2 sm:hidden">
        <ModeBadge />
      </div>
    </header>
  );
}

export function Footer() {
  const { mode } = useChain();
  return (
    <footer className="mx-auto mt-16 max-w-5xl px-4 pb-12 text-xs leading-relaxed text-muted">
      <div className="card p-4">
        <p className="mb-2 font-semibold text-fg">What is real and what is mocked</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          <li>Money: devnet test USDC (no real value){mode === "simulated" ? " — currently simulated in your browser" : ""}.</li>
          <li>Wallet: keypair generated in your browser (localStorage). No login.</li>
          <li>Loans &amp; credit limit: {mode === "devnet" ? "real devnet program." : "simulated (same rules as the program)."}</li>
          <li>Network fees: sponsored by the app.</li>
          <li>Products &amp; delivery: demo listings. Nothing ships.</li>
          <li>Amazon comparison: dated snapshot with source link, illustrative. Hidden until verified.</li>
          <li>Local currency: display only, from an FX rate.</li>
        </ul>
      </div>
    </footer>
  );
}

export function CurrencySwitcher() {
  const { code, setCode, rates } = useCurrency();
  return (
    <label
      className="inline-flex items-center gap-2 text-sm text-muted"
      title={`Display only. USDC is settled in USDC. Rates: ${rates.source === "live" ? `live, ${rates.asOf ?? ""}` : "approx. static fallback"}.`}
    >
      <span className="sr-only">Display currency</span>
      <select
        value={code}
        onChange={(e) => setCode(e.target.value as CurrencyCode)}
        className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-fg"
      >
        {SUPPORTED.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className="text-xs">{rates.source === "live" ? "live rate" : "approx. rate"}</span>
    </label>
  );
}

export function Row({ label, value, strong, muted }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? "font-semibold" : ""} ${muted ? "text-muted" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function shortAddr(a: string | null | undefined) {
  if (!a) return "—";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
