# Bipter — STATUS

Last updated: Sun 8 Nov 2026, ~19:40 IST. Mode: **Simulated** (devnet adapter not built yet).

## M0 — scaffold

| Item | Result | Evidence | Notes |
|---|---|---|---|
| Next.js scaffold | ✅ | `create-next-app@15` (App Router, TS, Tailwind 4) | npm name `bipter`, brand "Bipter" |
| Catalog data | ✅ | `data/products.json`, 7 products | Amazon fields `null`, `verified: false` |
| `npm run check:catalog` | ⚠️ | `7 products, 0 verified, 0 failing.` | Nothing asserted until a human fills dated Amazon snapshots |
| Solana toolchain | ⚠️ | `which solana anchor` → not found | Not installed (per brief, not attempted). Program goes to Solana Playground |

## M1 — all pages on simulated adapter

| Item | Result | Evidence | Notes |
|---|---|---|---|
| `npm run build` | ✅ | `✓ Compiled successfully`, 7 routes generated | |
| `npx tsc --noEmit` | ✅ | exit 0, no output | |
| `npm run lint` | ✅ | eslint, no output | |
| `npm run check:catalog` | ⚠️ | `7 products, 0 verified, 0 failing.` | See M0 |
| Playwright screenshots 390 + 1280 | ✅ | `npm run screenshots` → 16 PNGs in `./screenshots`, `No console errors.` | Opened product-1280, store-390, dashboard-with-loan-1280: layout OK |
| Hydration error | ✅ fixed | First manual run logged React #418; cause: locale-dependent `Intl.NumberFormat` on server vs client. Now fixed locale until mount; rerun shows no console errors | |
| Simulated loan, full lifecycle | ✅ | Browser run: buy keyboard (total 48.6875) → fast-forward + collect ×3 → `Repaid · 4/4`. State: buyer 100 → 51.3125, merchant +47.50 (item 45 + delivery 2.5), vault +1.1875 net, limit 100 → 125, outstanding 0 | Matches program rules |
| Cart, mixed plans | ✅ | Earbuds "Pay in full" + Backpack "Pay in 4" → one transfer + one loan → redirected to receipt | |
| Currency | ✅ | INR auto-detected (timezone Asia/Kolkata), "live rate" from open.er-api.com; switcher works | Static fallback table if fetch fails, labeled "approx. rate" |
| Mocked-labels footer + mode badge | ✅ | Visible on every page; badge shows "Simulated" | No Explorer links in simulated mode |

## M2 — program (human, Solana Playground)

| Item | Result | Evidence | Notes |
|---|---|---|---|
| `program/lib.rs` written | ⚠️ | File exists | **Not compiled** — no Anchor toolchain here. Must be built in Playground |
| Deployed program ID + IDL | ❌ | — | Waiting on human |

Deviations from the brief (in the program): `init_credit` and `init_lp` are separate instructions instead of `init_if_needed` (avoids needing a cargo feature in Playground). A `payer` signer (sponsor) pays rent for new accounts so the buyer needs no SOL. Vault is a PDA token account `["vault"]` owned by the Pool PDA.

Adapter additions beyond the 8 listed methods: `payInFull`, `getMerchantBalance`, `getMerchantAddress` (needed for cart "Pay in full" and the receipt merchant panel).

## M3 — devnet adapter, API routes, scripts

Not started. Blocked on: program ID + IDL, and `.env` keys.

## Known broken
- No verified Amazon prices → no "Save" chips, no Amazon bar in the X-ray (by design until verified).
- Devnet mode: selecting `NEXT_PUBLIC_CHAIN_MODE=devnet` throws "Devnet adapter not built yet" on every call.
- `program/lib.rs` has never been compiled.
- Simulated pool tops itself up by 1,000 USDC when low (stand-in for `setup-devnet` seeding liquidity).
- Network fee in simulated mode is an estimate (2 × 5,000 lamports), labeled as such.
