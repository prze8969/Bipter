# Bipter — Pay in 4 on Solana

Buy Now Pay Later store on Solana (MLH Solana Hackathon, DeFi track).

The merchant is paid in full instantly from a USDC liquidity pool. The buyer pays 4 equal installments; installments 2–4 are pulled automatically through a **capped SPL token delegation** (exactly 3 × installment). A Solana payment costs a fraction of a cent instead of ~3% + a fixed fee for cards, so the saving goes to the buyer. Every loan has a public receipt with the exact fee breakdown (and Explorer links in devnet mode).

> **Current state: Simulated mode.** The UI runs on an in-browser adapter that enforces the same rules as the on-chain program. The devnet adapter is not wired yet (see `STATUS.md`).

## Real vs mocked

| Part | Status |
|---|---|
| Money in the wallet | Devnet **test USDC** (real SPL token, no real value). In simulated mode: a number in your browser |
| Wallet | Keypair auto-generated in the browser, kept in localStorage. No login, no auth (prototype) |
| Loans, installments, credit limit | Real devnet program in devnet mode; **simulated** (same rules) in simulated mode |
| Network fees | Sponsored by the app (gasless for the user) |
| Products and delivery | Demo listings. Nothing ships |
| Amazon comparison | Dated snapshot with a source link, illustrative. **Hidden until a human verifies the values** |
| Currency display | Local currency from browser locale/timezone, FX rate for display only |

## Pricing

`total = item + delivery + platform fee (1%) + interest (1.5% flat)`, rounded up to a multiple of 4 micro-USDC (rounding goes into interest). Network fee is shown separately and paid by Bipter. Pay in full = item + delivery + 1% fee, no interest. Constants live in `lib/pricing.ts`.

## Run

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_CHAIN_MODE=simulated works with no other values
npm run dev
```

Checks:

```bash
npm run build && npx tsc --noEmit && npm run lint
npm run check:catalog        # our total < Amazon total for every verified product
npm run start & npm run screenshots   # Playwright screenshots at 390px + 1280px, fails on console errors
```

## Program

`program/lib.rs` (Anchor). Build and deploy it in [Solana Playground](https://beta.solpg.io), devnet. Accounts: `Pool ["pool"]`, vault `["vault"]`, `CreditProfile ["credit", buyer]`, `Loan ["loan", buyer, nonce]`, `LpPosition ["lp", owner]`. Instructions: `init_pool`, `init_lp`, `deposit`, `init_credit`, `create_loan`, `pay_installment`, `admin_force_due`, `mark_default`.

## 60-second demo (simulated)

1. Dashboard → **Add fake money** (+100 test USDC, shown in your local currency).
2. **Test it on the store** → open a product → Fee X-ray shows every cent.
3. **Buy now, pay later** → checkout modal → receipt. Merchant panel shows "paid at checkout" in full.
4. **Fast-forward (demo)** → **Collect next installment** ×3 → loan Repaid, credit limit 100 → 125 USDC.
