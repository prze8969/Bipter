"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Circle, Clock, ExternalLink, Loader2, X } from "lucide-react";
import { useChain, useCurrency } from "./providers";
import { explorerTx, type Loan, type TxRecord } from "@/lib/chain";
import { INSTALLMENTS, INTERVAL_SECS, type Breakdown } from "@/lib/pricing";
import { Row } from "./ui";

/* ---------------- time ---------------- */

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function countdown(target: number, now: number) {
  const s = Math.max(0, Math.ceil((target - now) / 1000));
  if (s === 0) return "due now";
  const m = Math.floor(s / 60);
  return m > 0 ? `in ${m}m ${s % 60}s` : `in ${s}s`;
}

/* ---------------- credit ---------------- */

export function CreditMeter() {
  const { credit } = useChain();
  const { fmt } = useCurrency();
  if (!credit) return <div className="card h-28 animate-pulse p-5" />;
  const used = credit.limit ? Math.min(1, credit.outstanding / credit.limit) : 0;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted">Credit limit</p>
        <p className="text-sm text-muted">{credit.repaidCount} loans repaid</p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {fmt(credit.limit - credit.outstanding)} <span className="text-base font-normal text-muted">available of {fmt(credit.limit)}</span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-fg transition-all duration-500" style={{ width: `${used * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {credit.defaulted ? "Defaulted: new loans are blocked." : "Every loan repaid on time raises your limit by 25 USDC."}
      </p>
    </div>
  );
}

/* ---------------- loans ---------------- */

export function LoanList({ only = "active" }: { only?: "active" | "all" }) {
  const { loans, ready } = useChain();
  const { fmt } = useCurrency();
  const now = useNow();
  const list = only === "active" ? loans.filter((l) => l.status === "Active") : loans;
  if (!ready) return <div className="card h-24 animate-pulse" />;
  if (!list.length)
    return (
      <div className="card p-5 text-sm text-muted">
        No {only === "active" ? "active " : ""}loans yet.{" "}
        <Link href="/store" className="text-fg underline underline-offset-4">
          Browse the store
        </Link>
      </div>
    );
  return (
    <div className="grid gap-3">
      {list.map((l) => (
        <Link key={l.id} href={`/receipt/${l.id}`} className="card fade-up flex items-center gap-4 p-4 transition-colors hover:border-[#cfcec7]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{l.label}</p>
            <p className="text-sm text-muted">
              {l.paid}/{INSTALLMENTS} paid ·{" "}
              {l.status === "Active" ? `next ${fmt(l.installment)} ${countdown(l.nextDue, now)}` : l.status}
            </p>
          </div>
          <Dots paid={l.paid} />
          <ArrowRight size={18} className="text-muted" />
        </Link>
      ))}
    </div>
  );
}

function Dots({ paid }: { paid: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: INSTALLMENTS }).map((_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < paid ? "bg-accent" : "bg-line"}`} />
      ))}
    </div>
  );
}

/* ---------------- breakdown ---------------- */

export function BreakdownRows({ b, networkFeeLamports }: { b: Breakdown; networkFeeLamports: number | null }) {
  const { fmt } = useCurrency();
  return (
    <div className="text-sm">
      <Row label="Item" value={fmt(b.item)} />
      <Row label="Delivery" value={fmt(b.delivery)} />
      <Row label="Platform fee (1%)" value={fmt(b.platformFee)} />
      <Row label="Interest (1.5% flat)" value={fmt(b.interest)} />
      <Row
        label="Network fee"
        muted
        value={
          <span>
            {networkFeeLamports == null ? "—" : `${(networkFeeLamports / 1e9).toFixed(6)} SOL`} · paid by Bipter
          </span>
        }
      />
      <div className="my-2 h-px bg-line" />
      <Row label="You pay in total" value={fmt(b.totalOwed)} strong />
      <Row label={`${INSTALLMENTS} × installment`} value={fmt(b.installment)} muted />
    </div>
  );
}

/* ---------------- fee x-ray ---------------- */

type Seg = { label: string; value: number; tone: string };

export function FeeXray({ b, amazon, networkFeeMicro }: { b: Breakdown; amazon: { item: number; delivery: number } | null; networkFeeMicro: number }) {
  const { fmt } = useCurrency();
  const ours: Seg[] = [
    { label: "Item", value: b.item, tone: "bg-fg" },
    { label: "Delivery", value: b.delivery, tone: "bg-[#8a8a84]" },
    { label: "Platform fee", value: b.platformFee, tone: "bg-accent" },
    { label: "Interest", value: b.interest, tone: "bg-[#ffb08a]" },
    { label: "Network fee", value: networkFeeMicro, tone: "bg-ok" },
  ];
  const theirs: Seg[] | null = amazon
    ? [
        { label: "Item", value: amazon.item, tone: "bg-fg" },
        { label: "Delivery", value: amazon.delivery, tone: "bg-[#8a8a84]" },
      ]
    : null;
  const oursTotal = b.totalOwed;
  const theirsTotal = theirs ? theirs.reduce((s, x) => s + x.value, 0) : 0;
  const max = Math.max(oursTotal, theirsTotal);
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold">Fee X-ray</p>
      <div className="mt-4 grid gap-4">
        {theirs ? (
          <Bar name="Amazon" total={fmt(theirsTotal)} segs={theirs} max={max} />
        ) : (
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Amazon</span>
              <span className="text-muted">price not verified</span>
            </div>
            <div className="mt-1.5 h-4 rounded-full border border-dashed border-line" />
          </div>
        )}
        <Bar name="Bipter (Pay in 4)" total={fmt(oursTotal)} segs={ours} max={max} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {ours.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${s.tone}`} />
            {s.label} {fmt(s.value)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Network fee is shown for transparency and paid by Bipter, so it is not in your total.</p>
    </div>
  );
}

function Bar({ name, total, segs, max }: { name: string; total: string; segs: Seg[]; max: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{name}</span>
        <span className="font-semibold tabular-nums">{total}</span>
      </div>
      <div className="mt-1.5 flex h-4 overflow-hidden rounded-full bg-line">
        {segs.map((s) => (
          <div
            key={s.label}
            className={`${s.tone} h-full transition-all duration-500`}
            style={{ width: `${max ? (s.value / max) * 100 : 0}%`, minWidth: s.value > 0 ? 2 : 0 }}
            title={s.label}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- schedule preview ---------------- */

export function SchedulePreview({ installment }: { installment: number }) {
  const { fmt } = useCurrency();
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold">Installment schedule</p>
      <ol className="mt-3 grid gap-2 text-sm">
        {Array.from({ length: INSTALLMENTS }).map((_, i) => (
          <li key={i} className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-line text-xs">{i + 1}</span>
              {i === 0 ? "Today, at checkout" : `+${i * INTERVAL_SECS} s (auto-collected)`}
            </span>
            <span className="tabular-nums">{fmt(installment)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">
        Demo interval is {INTERVAL_SECS} seconds. Payments 2–4 are pulled via a capped token delegation of exactly 3 installments.
      </p>
    </div>
  );
}

/* ---------------- receipt schedule ---------------- */

export function LoanSchedule({ loan }: { loan: Loan }) {
  const { fmt } = useCurrency();
  const { mode } = useChain();
  const now = useNow();
  const txFor = (i: number): TxRecord | undefined => loan.txs.find((t) => t.index === i);
  return (
    <ol className="grid gap-2 text-sm">
      {Array.from({ length: INSTALLMENTS }).map((_, k) => {
        const i = k + 1;
        const t = txFor(i);
        const isNext = loan.status === "Active" && i === loan.paid + 1;
        const due = isNext && now >= loan.nextDue;
        return (
          <li key={i} className={`flex items-center gap-3 rounded-xl border p-3 ${isNext ? "border-fg" : "border-line"}`}>
            {t ? (
              <Check size={18} className="text-ok" />
            ) : isNext ? (
              <Clock size={18} className={due ? "text-accent" : "text-muted"} />
            ) : (
              <Circle size={18} className="text-line" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Installment {i} · {fmt(loan.installment)}
              </p>
              <p className="text-xs text-muted">
                {t
                  ? `Paid ${new Date(t.at).toLocaleTimeString()}`
                  : isNext
                    ? due
                      ? "Due now, ready to collect"
                      : `Due ${countdown(loan.nextDue, now)}`
                    : loan.status === "Defaulted"
                      ? "Not collected (defaulted)"
                      : "Upcoming"}
              </p>
            </div>
            {t?.sig && mode === "devnet" ? (
              <a href={explorerTx(t.sig)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline underline-offset-4">
                Explorer <ExternalLink size={12} />
              </a>
            ) : t && mode === "simulated" ? (
              <span className="text-xs text-muted">simulated</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- checkout modal ---------------- */

export type CheckoutJob = {
  pay4: { label: string; productIds: string[]; breakdown: Breakdown }[];
  fullAmount: number;
  fullLabel: string;
};

type StepState = "idle" | "run" | "done" | "fail";

export function CheckoutModal({ job, onClose, onDone }: { job: CheckoutJob; onClose: () => void; onDone: (loanIds: string[]) => void }) {
  const { adapter, refresh, balance, credit } = useChain();
  const { fmt } = useCurrency();
  const steps = [
    ...(job.fullAmount > 0 ? [{ key: "full", label: `Pay ${fmt(job.fullAmount)} in full to merchant` }] : []),
    ...job.pay4.map((p, i) => ({
      key: `loan${i}`,
      label: `${p.label}: approve capped delegation, pay installment 1, pool pays merchant`,
    })),
    { key: "receipt", label: "Write receipt" },
  ];
  const [state, setState] = useState<Record<string, StepState>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const dueToday = job.fullAmount + job.pay4.reduce((s, p) => s + p.breakdown.installment, 0);
  const newDebt = job.pay4.reduce((s, p) => s + p.breakdown.totalOwed, 0);
  const available = credit ? credit.limit - credit.outstanding : 0;

  async function run() {
    setRunning(true);
    setError(null);
    const ids: string[] = [];
    try {
      if (job.fullAmount > 0) {
        setState((s) => ({ ...s, full: "run" }));
        await adapter.payInFull(job.fullAmount, job.fullLabel);
        setState((s) => ({ ...s, full: "done" }));
      }
      for (let i = 0; i < job.pay4.length; i++) {
        const k = `loan${i}`;
        setState((s) => ({ ...s, [k]: "run" }));
        const loan = await adapter.createLoan(job.pay4[i]);
        ids.push(loan.id);
        setState((s) => ({ ...s, [k]: "done" }));
      }
      setState((s) => ({ ...s, receipt: "run" }));
      await refresh();
      setState((s) => ({ ...s, receipt: "done" }));
      onDone(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState((s) => {
        const next = { ...s };
        for (const k of Object.keys(next)) if (next[k] === "run") next[k] = "fail";
        return next;
      });
      await refresh();
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/30 sm:place-items-center" role="dialog" aria-modal>
      <div className="card fade-up w-full max-w-md rounded-b-none p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">Checkout</p>
          <button onClick={onClose} disabled={running} className="rounded-lg p-1 text-muted hover:text-fg" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-bg p-4 text-sm">
          <Row label="Due today" value={fmt(dueToday)} strong />
          {newDebt > 0 && <Row label="Later (3 auto-collected installments per loan)" value={fmt(newDebt - (dueToday - job.fullAmount))} muted />}
          <Row label="Your balance" value={fmt(balance)} muted />
          {newDebt > 0 && <Row label="Credit available" value={fmt(available)} muted />}
        </div>

        {job.pay4.length > 0 && (
          <div className="mt-4 text-sm">
            <p className="mb-2 text-muted">Schedule</p>
            {job.pay4.map((p, i) => (
              <div key={i} className="flex justify-between py-1">
                <span className="truncate pr-2">{p.label}</span>
                <span className="shrink-0 tabular-nums">
                  4 × {fmt(p.breakdown.installment)} · every {INTERVAL_SECS}s
                </span>
              </div>
            ))}
          </div>
        )}

        <ol className="mt-5 grid gap-3 text-sm">
          {steps.map((s) => {
            const st = state[s.key] ?? "idle";
            return (
              <li key={s.key} className="flex items-start gap-3">
                <span className="mt-0.5">
                  {st === "done" ? (
                    <Check size={18} className="text-ok" />
                  ) : st === "run" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : st === "fail" ? (
                    <X size={18} className="text-accent" />
                  ) : (
                    <Circle size={18} className="text-line" />
                  )}
                </span>
                <span className={st === "idle" ? "text-muted" : ""}>{s.label}</span>
              </li>
            );
          })}
        </ol>

        {error && <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">{error}</p>}

        <button className="btn btn-primary mt-6 w-full text-base" onClick={run} disabled={running}>
          {running ? <Loader2 size={18} className="animate-spin" /> : null}
          {running ? "Processing…" : error ? "Try again" : `Confirm and pay ${fmt(dueToday)}`}
        </button>
        <p className="mt-3 text-center text-xs text-muted">Network fees are sponsored. You pay no SOL.</p>
      </div>
    </div>
  );
}
