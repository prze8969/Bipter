# Bipter — STATUS

Last updated: Sun 8 Nov 2026, ~21:10 IST.

**Bottom line:** the Bipter program is deployed on Solana devnet and `npm run e2e:devnet` **passes (19/19 checks)** against it. The app's own devnet adapter also passes a separate on-chain test (11/11). The connected-wallet UI has **not** been clicked through with a real Phantom/Solflare extension yet (Playwright cannot load one).

## Devnet deployment

| What | Address |
|---|---|
| Program | [`Gr4cJ334mV89q7k6A7hQfqDve94u9AEqAucp3vgkf3H8`](https://explorer.solana.com/address/Gr4cJ334mV89q7k6A7hQfqDve94u9AEqAucp3vgkf3H8?cluster=devnet) (built + deployed in Solana Playground) |
| Test USDC mint (6 decimals) | `ECVHLKwQRXuRtFzcsBRpY1W1wHSHTu21KRTsAViN1CKU` |
| Pool PDA | `8q9kkFFyFBDyVti4kfgDbJRHRsrtNqhMbbdAjy2m5JAj` (interval 60 s, grace 120 s) |
| Vault | `DvcZdQZerAcaBEnjJF1ca8nvKGPVVhY16fjXD4E2nzki`, seeded with 1,000 test USDC |
| Merchant | `QGYFGWoiHTZGRMf8rDbWkBqvgau7qyLL9R8SShnp5kw` |
| Admin | `E3HLjynBGCTpTkH75ruQMfpZyVeWEb4DUXkLTiVhx9fR` |

## Verification

| Item | Result | Evidence | Notes |
|---|---|---|---|
| `npm run setup:devnet` | ✅ | program deployed; mint created; merchant ATA; pool initialised; `deposited 1000 USDC liquidity`; `vault ...: 1000 USDC` | Confirms the hand-built instructions match the deployed program |
| `npm run e2e:devnet` | ✅ | `E2E PASSED`, 19 PASS lines. Loan `FSZ3F6SmyYak1MC71UQ2MZpB25ehDQ58Aa7r9KdwrAm` | Checks buyer −26.1375, merchant +25.50 paid at checkout, vault +0.6375 net, early `pay_installment` rejected (NotDue), paid 1→4, Repaid, limit 100→125, outstanding 0, delegation 0 |
| `npm run test:adapter` (app adapter, keypair standing in for the wallet) | ✅ after fix | `ADAPTER TEST PASSED`, 11 PASS | Two concurrent loans; delegation cap = 3+3 installments; delegate = pool PDA; getProgramAccounts listing; friendly "Installment not due yet"; collect via adapter; receipt tx history; real fee 5000 lamports; pay in full |
| Bug found by adapter test | ✅ fixed | First run: receipt history order `force_due, installment#1, create#1` | RPC signature order is not chronological. Now sorted by slot; installments numbered 2–4 explicitly |
| API `/api/faucet` | ✅ | minted 100 USDC to a fresh wallet (balance read back `"100"`); second call → `Faucet cooldown: try again in 29s`; bad key → `wallet is not a valid public key` | |
| API `/api/sol` | ✅ | `{"via":"sponsor"}`, fresh wallet balance 200000000 lamports | Changed from 1 SOL to 0.2 SOL per request: sponsor only has ~0.7 SOL left, and the devnet RPC airdrop fallback is closed (`410 The RPC faucet is closed`) |
| API `/api/admin/force-due` | ✅ | on a repaid loan → `Loan is not active` | Success path covered by e2e (same instruction) |
| `npm run build` | ✅ | `✓ Compiled successfully` | Harmless `bigint: Failed to load bindings` warning |
| `npx tsc --noEmit` | ✅ | exit 0 | |
| `npm run lint` | ✅ | no output | |
| `npm run check:catalog` | ⚠️ | `7 products, 0 verified, 0 failing.` | No Amazon snapshots (human task) |
| Playwright light + dark, 390 + 1280 | ✅ (not connected) | `24 screenshots`, `No console errors.` | Connected states not screenshot-tested |

## Wallet notes (21:20)
- MetaMask's Solana snap crashed during checkout (`The Snap "npm:@metamask/solana-wallet-snap" has been terminated during execution`). The app now asks the wallet to **sign only** and broadcasts the transaction itself (falls back to sign-and-send). This path is verified on-chain by `test:adapter`: 2 loans created + 1 installment collected, 8 PASS. The run then hit `Connection rate limits exceeded` on the public devnet RPC before its last 3 checks.
- MetaMask snap errors now show a plain message ("Nothing was charged. Try again, or use Phantom / Solflare"). Wallet errors are no longer logged as console errors (no Next.js dev overlay).
- **Phantom is the recommended wallet** (connect screen + checkout hint). Not re-tested with MetaMask after the change.
- The public devnet RPC rate-limits (429s seen in e2e and adapter tests). For the demo, a private devnet RPC in `NEXT_PUBLIC_RPC_URL` is safer.

## UI + token name update (~21:50)

| Item | Result | Evidence | Notes |
|---|---|---|---|
| Token name on devnet | ✅ | `npm run token:metadata` → `metadata exists: "Bipter Test USD" (tUSDC)` | Metaplex metadata, signed by the mint authority. No logo (empty URI). First run's read-back failed on RPC lag; the script now retries |
| Phantom checkout (human) | ✅ | User reported "it works, everything does" | Phantom showed the expected approval warning (now explained on /help) |
| New home hero "Bipter on Solana", Connect wallet, Troubleshoot | ✅ | screenshots dashboard-*-{390,768,1280,1920,3840} | Small grey hint text removed |
| /help page | ✅ | wallets, devnet setup, test money, "unsafe" warnings explained, common errors, real vs mocked, contract addresses | |
| Footer + /privacy + /terms | ✅ | GitHub, LinkedIn, Instagram, email links; legal pages | Legal text is a plain-English prototype policy, not reviewed by a lawyer |
| Responsive 390 → 4K | ✅ | `90 screenshots`, `No console errors.` (9 pages × light/dark × 390, 768, 1280, 1920, 3840) | Container is rem-based; root font scales at ≥2200px and ≥3000px. Fixed: 4K content stuck in a narrow column; footer badge stretched; tall product image on tablets |
| build / tsc / lint | ✅ | `✓ Compiled successfully`, tsc exit 0, eslint clean | |
| check:catalog | ⚠️ | `7 products, 0 verified, 0 failing.` | |

## Known broken / not verified
- Connected-wallet UI: clicked through by the user with Phantom (reported working). Not automated; Solflare not tested.
- `/api/sol` depends on the sponsor's SOL (≈0.7 SOL left, 0.2 per request). Once empty, users must use faucet.solana.com (the error message links to it).
- Faucet and SOL cooldowns are in-memory (reset on restart, per server instance).
- No verified Amazon prices, so no "Save" chips and no Amazon bars.
- Loan labels (product name, item/delivery split) are browser-local display data. In another browser, the receipt shows "Loan Abcd…" and "Item + delivery" combined. All amounts still come from chain.
- `mark_default` is in the program but has no UI and is not tested.
