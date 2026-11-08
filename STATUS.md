# Bipter — STATUS

Last updated: Sun 8 Nov 2026, ~20:25 IST.

**Bottom line:** the app is built for Solana devnet (default `NEXT_PUBLIC_CHAIN_MODE=devnet`, wallet adapter, on-chain reads, real transactions), but it has **not yet run against a deployed program**. `program/lib.rs` is not deployed, `.env.local` has no program ID, mint or keys, so `npm run e2e:devnet` fails at its first step. Until e2e passes, nothing on-chain is verified.

## Devnet + dark mode update (19:55–20:25)

| Item | Result | Evidence | Notes |
|---|---|---|---|
| `npm run build` | ✅ | `✓ Compiled successfully`, 10 routes incl. `/api/faucet`, `/api/sol`, `/api/admin/force-due` | Harmless `bigint: Failed to load bindings, pure JS will be used` warning |
| `npx tsc --noEmit` | ✅ | exit 0 | |
| `npm run lint` | ✅ | no output (one unused-var warning found and fixed) | |
| `npm run check:catalog` | ⚠️ | `7 products, 0 verified, 0 failing.` | No Amazon snapshots yet (human task) |
| `npm run e2e:devnet` | ❌ | `E2E ERROR: NEXT_PUBLIC_PROGRAM_ID is empty in .env.local` | Blocked: program not deployed, no keys. Script is written but has never run |
| Playwright, light + dark, 390 + 1280 | ✅ (not connected) | `npm run screenshots` → `24 screenshots`, `No console errors.` Opened dashboard-dark-390, product-dark-1280, checkout-light-390, cart-dark-390, cart-light-390, store-dark-1280, receipt-light-1280 | Playwright has no wallet extension, so **connected states (balances, loans, receipts) are not screenshot-verified** |
| Layout fixes from screenshots | ✅ | Cart summary amounts wrapped at 390px → `whitespace-nowrap`; checkout modal showed 0.00 balances when disconnected → hidden; X-ray showed network fee as "0.00 USDC" → removed (SOL fee stays in the breakdown) | |
| Wallet adapter (Phantom, Solflare, devnet) | ⚠️ | Connect button renders in nav and on dashboard; modal opens | Not tested with a real wallet extension here |
| Browser keypair + fake balances removed | ✅ | `lib/chain/wallet.ts` deleted; balances come from `getTokenAccountBalance` / `getBalance` | |
| Dark mode | ✅ | Class strategy (`@custom-variant dark`), inline head script sets `.dark` before paint from localStorage or `prefers-color-scheme`; nav toggle saves `bipter.theme` | Contrast: muted text #9a9993 on #0b0b0c ≈ 7:1, light muted #6b6b66 on #f7f7f4 ≈ 5:1 |

### How devnet mode works (code, unverified on-chain)
- `lib/chain/program.ts`: instructions and account decoding built by hand from `program/lib.rs` (Anchor discriminators = sha256 of `global:<ix>` / `account:<Name>`), so no IDL file is needed. **Risk:** if the deployed program differs from `program/lib.rs`, these will not match.
- Checkout tx: create ATAs (idempotent) → `init_credit` if missing → SPL `approve` (delegate = pool PDA, amount = what is still owed on active loans + 3 × new installment, because approve replaces the previous delegation) → `create_loan`. The buyer's wallet signs and pays the SOL fee.
- Loans: `getProgramAccounts` filtered by size + buyer. Receipt tx list + Explorer links: `getSignaturesForAddress(loan)`, classified by Anchor log lines. Real fee from `meta.fee`.
- Only display labels (product name, item/delivery split) live in localStorage; without them the receipt shows "Item + delivery" combined.
- `/api/faucet`: mints 100 test USDC (30 s cooldown per wallet, in-memory). `/api/sol`: 1 SOL from `SPONSOR_SECRET`, then airdrop fallback, then error pointing to faucet.solana.com (10 min cooldown). `/api/admin/force-due`: demo fast-forward signed by `ADMIN_SECRET`.
- Removed: sponsored / gasless fees and `/api/sponsor`.

### What is needed to make e2e pass (human)
1. Deploy `program/lib.rs` in Solana Playground (it has **never been compiled**) and put the program ID in `.env.local` as `NEXT_PUBLIC_PROGRAM_ID`.
2. `npm run gen:keys` (fills empty `*_SECRET` values, prints public keys only), then fund the admin and sponsor public keys with devnet SOL.
3. `npm run setup:devnet` (mint, merchant, pool, 1,000 USDC liquidity; writes mint + merchant into `.env.local`).
4. `npm run e2e:devnet`, then restart the app.

## Earlier milestones
- M0/M1 (simulated UI): build, tsc, lint and screenshots passed at the time. The simulated adapter is now **local development only** (`NEXT_PUBLIC_CHAIN_MODE=simulated`) and still needs a connected wallet.

## Known broken
- **e2e:devnet has never passed.** On-chain behaviour (loan creation, delegated pulls, balances, credit limit) is unverified.
- `program/lib.rs` has never been compiled.
- Connected-wallet UI states are not screenshot-tested.
- Faucet / SOL rate limits are in-memory (reset on restart, per server instance).
- No verified Amazon prices → no "Save" chips or Amazon bars.
- `.env.local` was switched from `simulated` to `devnet` (only that flag; no secrets were written).
