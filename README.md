# Bipter — Pay in 4 on Solana

Buy Now Pay Later store on Solana devnet (MLH Solana Hackathon, DeFi track).

The merchant is paid in full instantly from a USDC liquidity pool. The buyer pays 4 equal installments; installments 2–4 are pulled automatically through a **capped SPL token delegation**. A Solana payment costs a fraction of a cent instead of ~3% + a fixed fee for cards, so the saving goes to the buyer. Every loan has a receipt with the exact fee breakdown and a Solana Explorer link (`?cluster=devnet`) for each transaction.

> **Status:** the app targets devnet by default, but the end-to-end test has **not yet passed** against a deployed program (the program is not deployed yet). See `STATUS.md` → "Known broken".

## Real vs mocked

| Part | Status |
|---|---|
| Money | Devnet **test USDC**: Bipter's own SPL mint (6 decimals), no real value |
| Wallet | Your own Phantom or Solflare wallet on devnet (Phantom: Settings > Developer Settings > Testnet Mode) |
| Network fees | Paid in devnet SOL by your wallet ("Get devnet SOL" button or faucet.solana.com) |
| Loans, installments, credit limit | Bipter Anchor program on devnet (`program/lib.rs`), read from on-chain accounts. **Not yet verified: e2e has not passed** |
| Products and delivery | Demo listings. Nothing ships |
| Amazon comparison | Dated snapshot with a source link, illustrative. Hidden until a human verifies the values |
| Local currency | Small display-only line next to USDC amounts, from an FX rate |
| `simulated` mode | Local development only (`NEXT_PUBLIC_CHAIN_MODE=simulated`), never used in devnet mode |

## Setup (devnet)

```bash
npm install
cp .env.example .env.local
```

1. Deploy `program/lib.rs` in [Solana Playground](https://beta.solpg.io) on devnet. Put the program ID in `NEXT_PUBLIC_PROGRAM_ID`.
2. `npm run gen:keys`: generates throwaway admin, mint-authority and sponsor keys into `.env.local` and prints their public keys. Fund admin and sponsor with devnet SOL at faucet.solana.com.
3. `npm run setup:devnet`: creates the test USDC mint, the merchant token account, the pool (60 s interval, 120 s grace) and 1,000 USDC of liquidity, and writes the mint and merchant into `.env.local`.
4. `npm run e2e:devnet`: new buyer, create loan, force due, pay 3 installments, assert balances.
5. `npm run dev`

## Checks

```bash
npm run build && npx tsc --noEmit && npm run lint
npm run check:catalog
npm run e2e:devnet
npm run start & npm run screenshots   # light + dark, 390px + 1280px, fails on console errors
```

## Pricing

`total = item + delivery + platform fee (1%) + interest (1.5% flat)`, rounded up to a multiple of 4 micro-USDC (rounding goes into interest). Pay in full = item + delivery + 1% fee. The network fee is paid separately in SOL. Constants live in `lib/pricing.ts`.

## Program

Accounts: `Pool ["pool"]`, vault `["vault"]`, `CreditProfile ["credit", buyer]`, `Loan ["loan", buyer, nonce]`, `LpPosition ["lp", owner]`. Instructions: `init_pool`, `init_lp`, `deposit`, `init_credit`, `create_loan`, `pay_installment`, `admin_force_due`, `mark_default`. The client (`lib/chain/program.ts`) builds instructions directly from these layouts; no IDL file is needed.

## 60-second demo

1. Connect Phantom (devnet) → **Get devnet SOL** → **Add fake money** (+100 test USDC).
2. **Test it on the store** → open a product → the Fee X-ray shows every cent.
3. **Buy now, pay later** → approve in your wallet → receipt with an Explorer link. The merchant panel shows "paid at checkout" in full.
4. **Fast-forward (demo admin)** → **Collect next installment** ×3 → Repaid, credit limit goes from 100 to 125 USDC. Each step has its own Explorer link.
