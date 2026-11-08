"use client";

import Link from "next/link";
import { useCurrency } from "@/components/providers";
import { CurrencySwitcher, ProductIcon } from "@/components/ui";
import { amazonTotal, productBreakdown, products, savingsVsAmazon } from "@/lib/pricing";

export default function Store() {
  const { fmt, local } = useCurrency();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Store</h1>
          <p className="mt-1 text-sm text-muted">Prices in devnet test USDC, including delivery, fees and interest. Pay in 4, no surprises.</p>
        </div>
        <CurrencySwitcher />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {products.map((p) => {
          const b = productBreakdown(p);
          const a = amazonTotal(p);
          const save = savingsVsAmazon(p);
          return (
            <Link key={p.id} href={`/product/${p.id}`} className="card fade-up flex flex-col p-4 transition-colors hover:border-line-strong sm:p-5">
              <div className="grid aspect-square place-items-center rounded-xl bg-bg text-fg">
                <ProductIcon name={p.icon} size={40} />
              </div>
              <p className="mt-4 text-sm font-medium leading-snug">{p.name}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{fmt(b.totalOwed)}</p>
              {local(b.totalOwed) && <p className="text-xs text-muted tabular-nums">{local(b.totalOwed)}</p>}
              <p className="text-xs text-muted tabular-nums">or 4 × {fmt(b.installment)}</p>
              <div className="mt-auto pt-3 text-xs">
                {a != null && save != null ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted line-through tabular-nums">Amazon {fmt(a)}</span>
                    {save > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">Save {fmt(save)}</span>}
                  </div>
                ) : (
                  <span className="text-muted">Amazon price not verified</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
