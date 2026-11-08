"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, ExternalLink, ShoppingCart } from "lucide-react";
import { useCart, useCurrency } from "@/components/providers";
import { ProductIcon } from "@/components/ui";
import { BreakdownRows, CheckoutModal, FeeXray, SchedulePreview, type CheckoutJob } from "@/components/finance";
import { EST_NETWORK_FEE_LAMPORTS, amazonTotal, getProduct, productBreakdown, savingsVsAmazon, toMicro } from "@/lib/pricing";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const p = getProduct(id);
  const { fmt, local } = useCurrency();
  const cart = useCart();
  const [job, setJob] = useState<CheckoutJob | null>(null);
  const [added, setAdded] = useState(false);

  if (!p)
    return (
      <div className="card p-6">
        Product not found.{" "}
        <Link className="underline" href="/store">
          Back to store
        </Link>
      </div>
    );

  const b = productBreakdown(p);
  const a = amazonTotal(p);
  const save = savingsVsAmazon(p);

  return (
    <div className="grid gap-6">
      <Link href="/store" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft size={16} /> Store
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="grid content-start gap-4">
          <div className="card grid aspect-[4/3] place-items-center">
            <ProductIcon name={p.icon} size={72} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">{p.ships_from} · nothing actually ships</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight tabular-nums">{fmt(b.totalOwed)}</p>
            {local(b.totalOwed) && <p className="text-xs text-muted">{local(b.totalOwed)} · display only</p>}
            <p className="text-sm text-muted tabular-nums">4 × {fmt(b.installment)}, first one today</p>
            {a != null && save != null ? (
              <p className="mt-2 text-sm">
                <span className="text-muted">Amazon {fmt(a)} </span>
                {save > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Save {fmt(save)}</span>}
                {p.amazon_source_url && (
                  <a href={p.amazon_source_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-xs text-muted underline">
                    snapshot {p.amazon_snapshot_date} <ExternalLink size={11} />
                  </a>
                )}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">Amazon price not verified</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="btn btn-primary h-14 text-base"
              onClick={() => setJob({ pay4: [{ label: p.name, productIds: [p.id], breakdown: b }], fullAmount: 0, fullLabel: "" })}
            >
              Buy now, pay later
            </button>
            <button
              className="btn btn-ghost h-14 text-base"
              onClick={() => {
                cart.add(p.id);
                setAdded(true);
                setTimeout(() => setAdded(false), 1500);
              }}
            >
              {added ? <Check size={18} /> : <ShoppingCart size={18} />}
              {added ? "Added" : "Add to cart"}
            </button>
          </div>
        </section>

        <section className="grid content-start gap-4">
          <FeeXray
            b={b}
            amazon={a != null ? { item: toMicro(p.amazon_price!), delivery: toMicro(p.amazon_delivery!) } : null}
          />
          <div className="card p-5">
            <p className="mb-2 text-sm font-semibold">Exact breakdown</p>
            <BreakdownRows b={b} networkFeeLamports={EST_NETWORK_FEE_LAMPORTS} />
            <p className="mt-2 text-xs text-muted">Network fee is an estimate (1 signature × 5,000 lamports). Your receipt shows the real fee read from the transaction.</p>
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold">How we kept it low</p>
            <ul className="grid gap-2 text-sm">
              <li>· No card network: a Solana payment costs a fraction of a cent, not ~3% plus a fixed fee.</li>
              <li>· Merchant is paid in full instantly from a USDC pool, so no extra merchant markup.</li>
              <li>· One flat 1.5% interest and a 1% platform fee. No late fees hidden in small print.</li>
            </ul>
          </div>
          <SchedulePreview installment={b.installment} />
        </section>
      </div>

      {job && (
        <CheckoutModal
          job={job}
          onClose={() => setJob(null)}
          onDone={(ids) => router.push(ids[0] ? `/receipt/${ids[0]}` : "/")}
        />
      )}
    </div>
  );
}
