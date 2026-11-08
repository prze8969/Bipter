/* One-time devnet setup: test USDC mint, merchant, pool (60 s interval, 120 s grace), 1,000 USDC liquidity.
 * Idempotent: skips whatever already exists. Writes NEXT_PUBLIC_USDC_MINT / NEXT_PUBLIC_MERCHANT into .env.local. */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { loadEnv, need, keypair, setEnv } from "./env";
import { decodePool, ixDeposit, ixInitLp, ixInitPool, pdas } from "../lib/chain/program";

const LIQUIDITY = BigInt(1_000_000_000); // 1,000 USDC

async function ensureSol(conn: Connection, who: string, pk: PublicKey, min: number) {
  let bal = await conn.getBalance(pk);
  if (bal < min) {
    console.log(`${who} ${pk.toBase58()} has ${bal / LAMPORTS_PER_SOL} SOL, trying a 1 SOL airdrop...`);
    try {
      const sig = await conn.requestAirdrop(pk, LAMPORTS_PER_SOL);
      await conn.confirmTransaction(sig, "confirmed");
      bal = await conn.getBalance(pk);
    } catch (e) {
      console.log(`  airdrop failed: ${(e as Error).message.slice(0, 100)}`);
    }
  }
  if (bal < min) throw new Error(`${who} ${pk.toBase58()} needs at least ${min / LAMPORTS_PER_SOL} devnet SOL. Fund it at https://faucet.solana.com and rerun.`);
  console.log(`${who} ${pk.toBase58()}: ${(bal / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
}

async function main() {
  loadEnv();
  const conn = new Connection(process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const programId = new PublicKey(need("NEXT_PUBLIC_PROGRAM_ID"));
  const admin = keypair("ADMIN_SECRET");
  const mintAuth = keypair("MINT_AUTHORITY_SECRET");

  const prog = await conn.getAccountInfo(programId);
  if (!prog?.executable) throw new Error(`Program ${programId.toBase58()} is not deployed on devnet`);
  console.log(`program ${programId.toBase58()}: deployed`);

  await ensureSol(conn, "admin", admin.publicKey, 0.2 * LAMPORTS_PER_SOL);
  await ensureSol(conn, "mint authority", mintAuth.publicKey, 0.05 * LAMPORTS_PER_SOL);

  // mint
  let mint: PublicKey;
  if (process.env.NEXT_PUBLIC_USDC_MINT?.trim()) {
    mint = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT.trim());
    console.log(`mint ${mint.toBase58()}: exists (from env)`);
  } else {
    mint = await createMint(conn, admin, mintAuth.publicKey, null, 6);
    setEnv("NEXT_PUBLIC_USDC_MINT", mint.toBase58());
    console.log(`mint ${mint.toBase58()}: created (6 decimals)`);
  }

  // merchant (receive-only demo address)
  let merchant: PublicKey;
  if (process.env.NEXT_PUBLIC_MERCHANT?.trim()) merchant = new PublicKey(process.env.NEXT_PUBLIC_MERCHANT.trim());
  else {
    merchant = Keypair.generate().publicKey;
    setEnv("NEXT_PUBLIC_MERCHANT", merchant.toBase58());
  }
  await getOrCreateAssociatedTokenAccount(conn, admin, mint, merchant, true);
  console.log(`merchant ${merchant.toBase58()}: token account ready`);

  // pool
  const p = pdas(programId);
  let poolInfo = await conn.getAccountInfo(p.pool);
  if (!poolInfo) {
    await sendAndConfirmTransaction(conn, new Transaction().add(ixInitPool(programId, admin.publicKey, mint, 60, 120)), [admin]);
    poolInfo = await conn.getAccountInfo(p.pool);
    console.log(`pool ${p.pool.toBase58()}: initialised (interval 60 s, grace 120 s)`);
  }
  const pool = decodePool(poolInfo!.data as Buffer);
  if (!pool.mint.equals(mint)) throw new Error(`Pool already uses mint ${pool.mint.toBase58()}; set NEXT_PUBLIC_USDC_MINT to it`);
  if (!pool.admin.equals(admin.publicKey)) throw new Error(`Pool admin is ${pool.admin.toBase58()}, not ADMIN_SECRET`);
  console.log(`pool ${p.pool.toBase58()}: admin ok, mint ok, interval ${pool.intervalSecs}s, grace ${pool.graceSecs}s`);

  // liquidity
  const vaultBal = BigInt((await conn.getTokenAccountBalance(p.vault)).value.amount);
  if (vaultBal < LIQUIDITY / BigInt(2)) {
    if (!(await conn.getAccountInfo(p.lp(admin.publicKey))))
      await sendAndConfirmTransaction(conn, new Transaction().add(ixInitLp(programId, admin.publicKey, admin.publicKey)), [admin]);
    const adminAta = await getOrCreateAssociatedTokenAccount(conn, admin, mint, admin.publicKey);
    await mintTo(conn, admin, mint, adminAta.address, mintAuth, LIQUIDITY);
    await sendAndConfirmTransaction(conn, new Transaction().add(ixDeposit(programId, admin.publicKey, adminAta.address, LIQUIDITY)), [admin]);
    console.log(`deposited ${Number(LIQUIDITY) / 1e6} USDC liquidity`);
  }
  const after = (await conn.getTokenAccountBalance(p.vault)).value.uiAmountString;
  console.log(`vault ${p.vault.toBase58()}: ${after} USDC`);
  console.log("\nSetup complete. .env.local updated. Restart the dev server so NEXT_PUBLIC_* values are picked up.");
}

main().catch((e) => {
  console.error(`SETUP FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
