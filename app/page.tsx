"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink, Fuel, Loader2, Plus } from "lucide-react";
import { useChain, useCurrency } from "@/components/providers";
import { CurrencySwitcher, TroubleshootButton, WalletButton, shortAddr } from "@/components/ui";
import { CreditMeter, LoanList } from "@/components/finance";
import { explorerAddr, explorerTx } from "@/lib/chain";

export default function Dashboard() {
  const { connected, ready, usdc, sol, wallet, adapter, refresh, mode, error, missing } = useChain();
  const { fmt, local } = useCurrency();
  const [busy, setBusy] = useState<"usdc" | "sol" | null>(null);
  const [msg, setMsg] = useState<{ text: string; sig?: string | null; link?: boolean } | null>(null);

  if (!connected)
    return (
      <div className="grid gap-6">
        <section className="grid min-h-[62vh] content-center gap-8 py-10">
          <h1 className="font-semibold leading-[0.95] tracking-tight" style={{ fontSize: "clamp(3rem, 9vw, 9rem)" }}>
            Bipter
            <br />
            <span className="text-accent">on Solana</span>
          </h1>
          <p className="max-w-3xl font-medium leading-snug" style={{ fontSize: "clamp(1.25rem, 2.2vw, 2rem)" }}>
            Buy now, pay in 4. The merchant is paid in full today, you pay four equal parts, and every cent is on-chain.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WalletButton size="lg" />
            <Link href="/store" className="btn btn-ghost h-14 px-7 text-base">
              Browse the store <ArrowRight size={18} />
            </Link>
            <TroubleshootButton />
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Merchant paid instantly", "The pool pays the full price at checkout."],
            ["4 equal payments", "Payments 2 to 4 are collected automatically."],
            ["Fees you can see", "Every fee and every transaction, on Explorer."],
          ].map(([t, d]) => (
            <div key={t} className="card p-6 sm:p-8">
              <p className="text-xl font-semibold tracking-tight sm:text-2xl">{t}</p>
              <p className="mt-2 text-base">{d}</p>
            </div>
          ))}
        </section>
      </div>
    );

  async function act(kind: "usdc" | "sol") {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "usdc") {
        const t = await adapter.faucet();
        setMsg({ text: "+100 test USDC minted to your wallet", sig: t.sig });
      } else {
        const t = await adapter.getSol();
        setMsg({ text: `Devnet SOL received (${t.via})`, sig: t.sig });
      }
      await refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), link: kind === "sol" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      {missing.length > 0 && (
        <p className="rounded-xl bg-accent-soft p-3 text-sm text-accent">Devnet config missing: {missing.join(", ")}. See README → Setup.</p>
      )}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Wallet{" "}
            {wallet && mode === "devnet" ? (
              <a className="font-mono underline underline-offset-4" href={explorerAddr(wallet)} target="_blank" rel="noreferrer">
                {shortAddr(wallet)}
              </a>
            ) : (
              <span className="font-mono">{shortAddr(wallet)}</span>
            )}{" "}
            · devnet
          </p>
          <CurrencySwitcher />
        </div>

        <div className="mt-4 grid gap-6 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-sm text-muted">USDC · for payments</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
              {ready ? fmt(usdc).replace(" USDC", "") : <span className="inline-block h-12 w-40 animate-pulse rounded-xl bg-line align-middle" />}
              <span className="ml-2 text-xl font-medium text-muted">USDC</span>
            </p>
            {local(usdc) && <p className="mt-1 text-xs text-muted">{local(usdc)} · display only</p>}
          </div>
          <div>
            <p className="text-sm text-muted">SOL · for network fees</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
              {ready ? (sol / 1e9).toFixed(4) : "—"}
              <span className="ml-2 text-base font-medium text-muted">SOL</span>
            </p>
            {ready && sol === 0 && <p className="mt-1 text-xs text-accent">You need a little SOL to sign transactions.</p>}
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">{error}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button className="btn btn-dark text-base" onClick={() => act("usdc")} disabled={busy != null}>
            {busy === "usdc" ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Add fake money
          </button>
          <button className="btn btn-ghost text-base" onClick={() => act("sol")} disabled={busy != null}>
            {busy === "sol" ? <Loader2 size={18} className="animate-spin" /> : <Fuel size={18} />}
            Get devnet SOL
          </button>
          <Link href="/store" className="btn btn-primary text-base">
            Test it on the store <ArrowRight size={18} />
          </Link>
        </div>
        {msg && (
          <p className="mt-3 text-sm text-muted">
            {msg.text}
            {msg.sig && mode === "devnet" && (
              <a className="ml-2 inline-flex items-center gap-1 underline underline-offset-4" href={explorerTx(msg.sig)} target="_blank" rel="noreferrer">
                Explorer <ExternalLink size={12} />
              </a>
            )}
            {msg.link && (
              <a className="ml-2 inline-flex items-center gap-1 underline underline-offset-4" href="https://faucet.solana.com" target="_blank" rel="noreferrer">
                faucet.solana.com <ExternalLink size={12} />
              </a>
            )}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          Test USDC is Bipter&apos;s own devnet mint (no real value). Out of SOL?{" "}
          <a className="underline underline-offset-4" href="https://faucet.solana.com" target="_blank" rel="noreferrer">
            faucet.solana.com
          </a>
        </p>
      </section>

      <CreditMeter />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Active loans</h2>
        <LoanList only="active" />
      </section>
    </div>
  );
}
