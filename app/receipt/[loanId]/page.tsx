"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, FastForward, Loader2, Store } from "lucide-react";
import { useChain, useCurrency } from "@/components/providers";
import { Row, shortAddr } from "@/components/ui";
import { BreakdownRows, LoanSchedule, countdown, useNow } from "@/components/finance";
import { explorerAddr, explorerTx, type TxRecord } from "@/lib/chain";
import { INSTALLMENTS } from "@/lib/pricing";

export default function Receipt() {
  const { loanId } = useParams<{ loanId: string }>();
  const { loans, ready, adapter, refresh, mode, merchantBalance, connected } = useChain();
  const { fmt } = useCurrency();
  const now = useNow();
  const [busy, setBusy] = useState<"collect" | "ff" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const loadTxs = useCallback(async () => {
    try {
      setTxs(await adapter.getLoanTxs(loanId));
    } catch {
      /* RPC hiccup: schedule still shows paid state from the loan account */
    }
  }, [adapter, loanId]);
  useEffect(() => {
    if (connected) loadTxs();
  }, [connected, loadTxs]);

  const loan = loans.find((l) => l.id === loanId);
  if (!ready) return <div className="card h-64 animate-pulse" />;
  if (!loan)
    return (
      <div className="card p-6">
        {connected ? "Loan not found for this wallet." : "Connect the wallet that took this loan."}{" "}
        <Link href="/" className="underline">
          Dashboard
        </Link>
      </div>
    );

  const due = loan.status === "Active" && now >= loan.nextDue;
  const realFee = txs.find((t) => t.kind === "create")?.feeLamports ?? null;
  const createSig = txs.find((t) => t.kind === "create")?.sig;

  async function act(kind: "collect" | "ff") {
    setBusy(kind);
    setErr(null);
    try {
      const r = kind === "collect" ? await adapter.payNextInstallment(loan!.id) : await adapter.forceDue(loan!.id);
      setLastSig(r.sig);
      await refresh();
      await loadTxs();
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
            loan.status === "Repaid" ? "bg-ok/10 text-ok" : loan.status === "Defaulted" ? "bg-accent-soft text-accent" : "bg-fg text-bg"
          }`}
        >
          {loan.status} · {loan.paid}/{INSTALLMENTS}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="grid content-start gap-4">
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold">Schedule</p>
            <LoanSchedule loan={loan} txs={txs} />
            {lastSig && mode === "devnet" && (
              <a href={explorerTx(lastSig)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs underline underline-offset-4">
                Last action on Explorer <ExternalLink size={12} />
              </a>
            )}
            {err && <p className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">{err}</p>}
            {loan.status === "Active" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button className="btn btn-primary text-base" onClick={() => act("collect")} disabled={!due || busy != null}>
                  {busy === "collect" && <Loader2 size={18} className="animate-spin" />}
                  {due ? "Collect next installment" : `Next ${countdown(loan.nextDue, now)}`}
                </button>
                <button className="btn btn-ghost text-base" onClick={() => act("ff")} disabled={due || busy != null}>
                  {busy === "ff" ? <Loader2 size={18} className="animate-spin" /> : <FastForward size={18} />}
                  Fast-forward (demo admin)
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
            <BreakdownRows b={loan.breakdown} networkFeeLamports={realFee} splitKnown={loan.splitKnown} />
            <p className="mt-2 text-xs text-muted">
              {mode === "devnet"
                ? realFee == null
                  ? "Network fee: loading from the checkout transaction…"
                  : "Network fee read from the checkout transaction, paid by your wallet in SOL."
                : "LOCAL DEV: network fee is an estimate."}
              {!loan.splitKnown && " Item and delivery are shown combined: only their sum is stored on-chain."}
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
