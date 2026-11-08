# Bipter — Pay in 4 on Solana

Buy Now Pay Later store on Solana devnet (MLH Solana Hackathon, DeFi track).

## First time here? Connect your wallet in 2 minutes

Bipter runs on Solana **devnet** (the test network). Everything uses test tokens with no real value.

1. **Install [Phantom](https://phantom.com)** (recommended) or [Solflare](https://solflare.com) as a browser extension, and create a wallet.
2. **Switch the wallet to devnet.**
   - Phantom: Settings → Developer Settings → **Testnet Mode** on → choose **Solana Devnet**.
   - Solflare: Settings → General → Network → **Devnet**.
3. **Open Bipter and click Connect wallet.** Pick your wallet and approve the connection.
4. **Get test SOL** (pays the tiny network fees): click **Get devnet SOL** on the dashboard. If it is empty, use [faucet.solana.com](https://faucet.solana.com).
5. **Get test money:** click **Add fake money** to receive 100 **Bipter Test USD (tUSDC)**.
6. **Buy something:** Store → pick a product → **Buy now, pay later** → approve in your wallet.

**Your wallet will show warnings. They are expected:**
- *"Allowing this dApp to withdraw funds in the future"* is the capped approval for installments 2–4: exactly 3 installments, collected only by the Bipter pool, only when due. You can revoke it at any time.
- *"Confirm (unsafe)"* appears because wallets flag apps they have not reviewed. This is a devnet prototype; no real money is involved.
- *"Unknown"* token: older wallet caches may not show the tUSDC name yet.

Stuck? Open the **Troubleshoot** button (`/help`) in the app. MetaMask's Solana support is experimental and has crashed during checkout, so use Phantom.

The merchant is paid in full instantly from a USDC liquidity pool. The buyer pays 4 equal installments; installments 2–4 are pulled automatically through a **capped SPL token delegation**. A Solana payment costs a fraction of a cent instead of ~3% + a fixed fee for cards, so the saving goes to the buyer. Every loan has a receipt with the exact fee breakdown and a Solana Explorer link (`?cluster=devnet`) for each transaction.

> **Status:** the program is deployed on devnet at [`Gr4cJ334mV89q7k6A7hQfqDve94u9AEqAucp3vgkf3H8`](https://explorer.solana.com/address/Gr4cJ334mV89q7k6A7hQfqDve94u9AEqAucp3vgkf3H8?cluster=devnet). `npm run e2e:devnet` passes (19/19), and the app's adapter test passes (11/11). Checkout has been clicked through with Phantom on devnet. See `STATUS.md`.

## Real vs mocked

| Part | Status |
|---|---|
| Money | Devnet **test USDC**: Bipter's own SPL mint (6 decimals), no real value |
| Wallet | Your own Phantom or Solflare wallet on devnet (Phantom: Settings > Developer Settings > Testnet Mode) |
| Network fees | Paid in devnet SOL by your wallet ("Get devnet SOL" sends 0.2 SOL from a sponsor key while it lasts, otherwise use faucet.solana.com) |
| Loans, installments, credit limit | Bipter Anchor program on devnet (`program/lib.rs`), read from on-chain accounts. Verified by `e2e:devnet` |
| Loan labels | Product name / item-delivery split are display labels kept in your browser. All amounts come from chain |
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
   `npm run test:adapter`: runs the app's own devnet adapter on-chain, with a keypair standing in for the wallet.
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
