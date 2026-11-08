"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { useChain, useCurrency } from "@/components/providers";
import { CurrencySwitcher, shortAddr } from "@/components/ui";
import { CreditMeter, LoanList } from "@/components/finance";
import { explorerAddr } from "@/lib/chain";
import { formatUsdc } from "@/lib/pricing";

export default function Dashboard() {
  const { ready, balance, wallet, adapter, refresh, mode, error } = useChain();
  const { fmt, code } = useCurrency();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function addMoney() {
    setBusy(true);
    setMsg(null);
    try {
      await adapter.faucet();
      await refresh();
      setMsg("+100 test USDC added");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Balance</p>
          <CurrencySwitcher />
        </div>
        <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
          {ready ? fmt(balance) : <span className="inline-block h-14 w-48 animate-pulse rounded-xl bg-line align-middle" />}
        </p>
        <p className="mt-2 text-sm text-muted tabular-nums">
          = {formatUsdc(balance)} USDC{code !== "USD" ? " · converted for display only" : ""}
        </p>
        <p className="mt-1 text-xs text-muted">
          Wallet{" "}
          {mode === "devnet" && wallet ? (
            <a className="underline underline-offset-4" href={explorerAddr(wallet)} target="_blank" rel="noreferrer">
              {shortAddr(wallet)}
            </a>
          ) : (
            <span className="font-mono">{shortAddr(wallet)}</span>
          )}{" "}
          · generated in this browser
        </p>
        {error && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">{error}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="btn btn-dark text-base" onClick={addMoney} disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Add fake money
          </button>
          <Link href="/store" className="btn btn-primary text-base">
            Test it on the store <ArrowRight size={18} />
          </Link>
        </div>
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
      </section>

      <CreditMeter />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Active loans</h2>
        <LoanList only="active" />
      </section>
    </div>
  );
}
