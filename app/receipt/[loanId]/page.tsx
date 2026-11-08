"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ExternalLink, FastForward, Loader2, Store } from "lucide-react";
import { useChain, useCurrency } from "@/components/providers";
import { Row, shortAddr } from "@/components/ui";
import { BreakdownRows, LoanSchedule, countdown, useNow } from "@/components/finance";
import { explorerAddr, explorerTx } from "@/lib/chain";
import { INSTALLMENTS } from "@/lib/pricing";

export default function Receipt() {
  const { loanId } = useParams<{ loanId: string }>();
  const { loans, ready, adapter, refresh, mode, merchantBalance } = useChain();
  const { fmt } = useCurrency();
  const now = useNow();
  const [busy, setBusy] = useState<"collect" | "ff" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loan = loans.find((l) => l.id === loanId);
  if (!ready) return <div className="card h-64 animate-pulse" />;
  if (!loan)
    return (
      <div className="card p-6">
        Loan not found in this browser.{" "}
        <Link href="/" className="underline">
          Dashboard
        </Link>
      </div>
    );

  const due = loan.status === "Active" && now >= loan.nextDue;
  const realFee = loan.txs.find((t) => t.kind === "create")?.feeLamports ?? null;
  const createSig = loan.txs.find((t) => t.kind === "create")?.sig;

  async function act(kind: "collect" | "ff") {
    setBusy(kind);
    setErr(null);
    try {
      if (kind === "collect") await adapter.payNextInstallment(loan!.id);
      else await adapter.forceDue(loan!.id);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Dashboard
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Receipt · {new Date(loan.createdAt).toLocaleString()}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{loan.label}</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            loan.status === "Repaid" ? "bg-ok/10 text-ok" : loan.status === "Defaulted" ? "bg-accent-soft text-accent" : "bg-fg text-white"
          }`}
        >
          {loan.status} · {loan.paid}/{INSTALLMENTS}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="grid content-start gap-4">
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold">Schedule</p>
            <LoanSchedule loan={loan} />
            {err && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">{err}</p>}
            {loan.status === "Active" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button className="btn btn-primary text-base" onClick={() => act("collect")} disabled={!due || busy != null}>
                  {busy === "collect" && <Loader2 size={18} className="animate-spin" />}
                  {due ? "Collect next installment" : `Next ${countdown(loan.nextDue, now)}`}
                </button>
                <button className="btn btn-ghost text-base" onClick={() => act("ff")} disabled={due || busy != null}>
                  {busy === "ff" ? <Loader2 size={18} className="animate-spin" /> : <FastForward size={18} />}
                  Fast-forward (demo)
                </button>
              </div>
            )}
            {loan.status === "Active" && (
              <p className="mt-3 text-xs text-muted">
                Anyone can trigger collection once it is due; the pool pulls exactly one installment via the capped delegation.
              </p>
            )}
          </div>

          <div className="card p-5">
            <p className="mb-2 text-sm font-semibold">Exact fee breakdown</p>
            <BreakdownRows b={loan.breakdown} networkFeeLamports={realFee} />
            <p className="mt-2 text-xs text-muted">
              {mode === "devnet" ? "Network fee read from the checkout transaction." : "Network fee is an estimate (simulated mode)."}
            </p>
          </div>
        </section>

        <section className="grid content-start gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Store size={16} /> Merchant
            </div>
            <p className="mt-1 text-xs text-muted">
              {mode === "devnet" ? (
                <a className="underline" href={explorerAddr(loan.merchant)} target="_blank" rel="noreferrer">
                  {shortAddr(loan.merchant)}
                </a>
              ) : (
                <span className="font-mono">{shortAddr(loan.merchant)}</span>
              )}
            </p>
            <div className="mt-4 rounded-xl bg-accent-soft p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">Paid at checkout</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{fmt(loan.breakdown.merchantAmount)}</p>
              <p className="text-xs text-muted">Item + delivery, in full, from the Bipter pool.</p>
            </div>
            <div className="mt-3 text-sm">
              <Row label="Merchant balance" value={fmt(merchantBalance)} />
              <Row label="Waiting on buyer installments" value="No" muted />
            </div>
          </div>

          <div className="card p-5 text-sm">
            <p className="mb-2 font-semibold">Loan</p>
            <Row label="Loan ID" value={<span className="font-mono text-xs">{loan.id.length > 16 ? shortAddr(loan.id) : loan.id}</span>} />
            <Row label="Buyer" value={<span className="font-mono text-xs">{shortAddr(loan.buyer)}</span>} />
            <Row label="Outstanding on this loan" value={fmt(loan.installment * (INSTALLMENTS - loan.paid))} />
            {mode === "devnet" && createSig && (
              <a href={explorerTx(createSig)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-4">
                Checkout transaction on Explorer <ExternalLink size={12} />
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
