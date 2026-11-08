"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart, useCurrency } from "@/components/providers";
import { ProductIcon, Row } from "@/components/ui";
import { CheckoutModal, type CheckoutJob } from "@/components/finance";
import { getProduct, productBreakdown } from "@/lib/pricing";

export default function CartPage() {
  const cart = useCart();
  const { fmt } = useCurrency();
  const router = useRouter();
  const [job, setJob] = useState<CheckoutJob | null>(null);

  const lines = cart.lines
    .map((l) => {
      const p = getProduct(l.productId);
      return p ? { ...l, p, b: productBreakdown(p, l.qty) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const full = lines.filter((l) => l.plan === "full");
  const pay4 = lines.filter((l) => l.plan === "pay4");
  const fullAmount = full.reduce((s, l) => s + l.b.payInFullTotal, 0);
  const todayPay4 = pay4.reduce((s, l) => s + l.b.installment, 0);
  const total = fullAmount + pay4.reduce((s, l) => s + l.b.totalOwed, 0);

  if (!lines.length)
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-medium">Your cart is empty</p>
        <Link href="/store" className="btn btn-primary mt-4">
          Go to the store
        </Link>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="grid content-start gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Cart</h1>
        {lines.map((l) => (
          <div key={l.productId} className="card fade-up p-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-bg">
                <ProductIcon name={l.p.icon} size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.p.name}</p>
                <p className="text-sm text-muted tabular-nums">
                  {l.plan === "full" ? fmt(l.b.payInFullTotal) : `4 × ${fmt(l.b.installment)} = ${fmt(l.b.totalOwed)}`}
                </p>
              </div>
              <button className="rounded-lg p-2 text-muted hover:text-fg" onClick={() => cart.remove(l.productId)} aria-label="Remove">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-line p-1 text-sm">
                {(["pay4", "full"] as const).map((plan) => (
                  <button
                    key={plan}
                    onClick={() => cart.setPlan(l.productId, plan)}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${l.plan === plan ? "bg-fg text-white" : "text-muted"}`}
                  >
                    {plan === "pay4" ? "Pay in 4" : "Pay in full"}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-2">
                <button className="btn-ghost grid h-8 w-8 place-items-center rounded-lg border border-line" onClick={() => cart.setQty(l.productId, l.qty - 1)} aria-label="Less">
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center tabular-nums">{l.qty}</span>
                <button className="btn-ghost grid h-8 w-8 place-items-center rounded-lg border border-line" onClick={() => cart.setQty(l.productId, l.qty + 1)} aria-label="More">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <p className="mb-2 text-sm font-semibold">Summary</p>
        <div className="text-sm">
          {full.length > 0 && <Row label="Pay in full (item + delivery + 1% fee)" value={fmt(fullAmount)} />}
          {pay4.length > 0 && <Row label={`Pay in 4: first installment${pay4.length > 1 ? "s" : ""}`} value={fmt(todayPay4)} />}
          <div className="my-2 h-px bg-line" />
          <Row label="Due today" value={fmt(fullAmount + todayPay4)} strong />
          <Row label="Total over all payments" value={fmt(total)} muted />
        </div>
        <button className="btn btn-primary mt-5 w-full text-base" onClick={() => setJob({
          pay4: pay4.map((l) => ({ label: l.qty > 1 ? `${l.p.name} × ${l.qty}` : l.p.name, productIds: [l.productId], breakdown: l.b })),
          fullAmount,
          fullLabel: full.map((l) => l.p.name).join(", "),
        })}>
          Checkout
        </button>
        <p className="mt-3 text-xs text-muted">Pay in 4 lines become one loan each, checked against your credit limit.</p>
      </aside>

      {job && (
        <CheckoutModal
          job={job}
          onClose={() => setJob(null)}
          onDone={(ids) => {
            cart.clear();
            router.push(ids.length === 1 ? `/receipt/${ids[0]}` : "/");
          }}
        />
      )}
    </div>
  );
}
