"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  Backpack, Cable, GlassWater, Headphones, Keyboard, LifeBuoy, Moon, Package, PlugZap, ShoppingBag, Smartphone, Sun, type LucideIcon,
} from "lucide-react";
import { useCart, useChain, useCurrency, useTheme } from "./providers";
import { SUPPORTED, type CurrencyCode } from "@/lib/currency";

const LABELS = {
  "change-wallet": "Change wallet",
  connecting: "Connecting…",
  "copy-address": "Copy address",
  copied: "Copied",
  disconnect: "Disconnect",
  "has-wallet": "Connect",
  "no-wallet": "Connect wallet",
} as const;

/** Wallet button renders client-only (wallet state does not exist on the server). */
const BaseButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.BaseWalletMultiButton),
  { ssr: false, loading: () => <span className="inline-block h-9 w-32 rounded-xl border border-line" /> },
);

export function WalletButton({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={size === "lg" ? "wallet-lg" : undefined}>
      <BaseButton labels={LABELS} />
    </span>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:text-fg"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        devnet ? "border-ok/30 text-ok" : "border-line text-muted"
      }`}
      title={devnet ? "Solana devnet. Test tokens, no real value." : "LOCAL DEV ONLY: simulated in your browser. No transactions are sent."}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${devnet ? "bg-ok" : "bg-muted"}`} />
      {devnet ? "Devnet" : "Simulated"}
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white">
        <ShoppingBag size={16} strokeWidth={2} />
      </span>
      Bipter
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const { count } = useCart();
  const items = [
    { href: "/", label: "Home" },
    { href: "/store", label: "Store" },
    { href: "/cart", label: count ? `Cart (${count})` : "Cart" },
    { href: "/help", label: "Help" },
  ];
  const links = items.map((it) => {
    const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
    return (
      <Link
        key={it.href}
        href={it.href}
        className={`rounded-lg px-2.5 py-1.5 transition-colors ${active ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}
      >
        {it.label}
      </Link>
    );
  });
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="wrap flex h-16 items-center gap-3">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 text-sm md:flex">{links}</nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <ModeBadge />
          </span>
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
      <nav className="wrap flex items-center gap-1 overflow-x-auto pb-3 text-sm md:hidden">
        {links}
        <span className="ml-auto sm:hidden">
          <ModeBadge />
        </span>
      </nav>
    </header>
  );
}

const SOCIAL = [
  { label: "GitHub", value: "prze8969", href: "https://github.com/prze8969" },
  { label: "LinkedIn", value: "pranav-shewale-prze8969", href: "https://www.linkedin.com/in/pranav-shewale-prze8969/" },
  { label: "Instagram", value: "@prze8969", href: "https://www.instagram.com/prze8969/" },
  { label: "Email", value: "shewalepranav66@gmail.com", href: "mailto:shewalepranav66@gmail.com" },
];

export function Footer() {
  const year = 2026;
  return (
    <footer className="mt-24 border-t border-line">
      <div className="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">Pay in 4 on Solana devnet. Built for the MLH Solana Hackathon.</p>
          <span className="justify-self-start">
            <ModeBadge />
          </span>
        </div>
        <FooterCol title="Product">
          <FooterLink href="/store">Store</FooterLink>
          <FooterLink href="/">Dashboard</FooterLink>
          <FooterLink href="/cart">Cart</FooterLink>
          <FooterLink href="/help">Help &amp; troubleshooting</FooterLink>
        </FooterCol>
        <FooterCol title="Legal">
          <FooterLink href="/privacy">Privacy policy</FooterLink>
          <FooterLink href="/terms">Terms &amp; conditions</FooterLink>
          <FooterLink href="/help#real-vs-mocked">What is real vs mocked</FooterLink>
        </FooterCol>
        <FooterCol title="Contact">
          {SOCIAL.map((s) => (
            <a key={s.label} href={s.href} target={s.href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer" className="group text-sm">
              <span className="text-muted">{s.label} · </span>
              <span className="break-all underline-offset-4 group-hover:underline">{s.value}</span>
            </a>
          ))}
        </FooterCol>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-muted">
          <span>© {year} Bipter · Pranav Shewale</span>
          <span>Devnet prototype. Test tokens only, no real money.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-2.5">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-muted transition-colors hover:text-fg">
      {children}
    </Link>
  );
}

export function TroubleshootButton() {
  return (
    <Link href="/help" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-fg">
      <LifeBuoy size={15} /> Troubleshoot
    </Link>
  );
}

export function CurrencySwitcher() {
  const { code, setCode, rates } = useCurrency();
  return (
    <label
      className="inline-flex items-center gap-2 text-sm text-muted"
      title={`Local currency is display only; everything settles in USDC. Rates: ${rates.source === "live" ? `live, ${rates.asOf ?? ""}` : "approx. static fallback"}.`}
    >
      <span className="sr-only">Local display currency</span>
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
      <span className="shrink-0 whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

export function shortAddr(a: string | null | undefined) {
  if (!a) return "—";
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
