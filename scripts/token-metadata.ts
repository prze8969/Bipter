/* Register a name + symbol for the devnet test USDC mint (Metaplex Token Metadata), so wallets
 * show "Bipter Test USD (tUSDC)" instead of "Unknown". Signed and paid by MINT_AUTHORITY_SECRET.
 * Idempotent: skips if metadata already exists. */
import { loadEnv, need, keypair } from "./env";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromKeypair, publicKey, signerIdentity, none } from "@metaplex-foundation/umi";
import { createMetadataAccountV3, findMetadataPda, fetchMetadata, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";

async function main() {
  loadEnv();
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
  const mint = publicKey(need("NEXT_PUBLIC_USDC_MINT"));
  const auth = keypair("MINT_AUTHORITY_SECRET");
  const umi = createUmi(rpc).use(mplTokenMetadata());
  const signer = createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(auth.secretKey));
  umi.use(signerIdentity(signer));

  const pda = findMetadataPda(umi, { mint });
  try {
    const m = await fetchMetadata(umi, pda);
    console.log(`metadata exists: "${m.name.trim()}" (${m.symbol.trim()}), skipping`);
    return;
  } catch {
    /* not created yet */
  }
  const res = await createMetadataAccountV3(umi, {
    metadata: pda,
    mint,
    mintAuthority: signer,
    payer: signer,
    updateAuthority: signer.publicKey,
    data: { name: "Bipter Test USD", symbol: "tUSDC", uri: "", sellerFeeBasisPoints: 0, creators: none(), collection: none(), uses: none() },
    isMutable: true,
    collectionDetails: none(),
  }).sendAndConfirm(umi);
  const sig = bs58.encode(res.signature);
  // the RPC can lag right after confirmation: retry the read-back
  let m: Awaited<ReturnType<typeof fetchMetadata>> | null = null;
  for (let i = 0; i < 10 && !m; i++) {
    try {
      m = await fetchMetadata(umi, pda);
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!m) throw new Error(`created (tx ${sig}) but could not read it back yet; rerun to check`);
  console.log(`metadata created: "${m.name.trim()}" (${m.symbol.trim()})  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}
main().catch((e) => {
  console.error(`TOKEN METADATA FAILED: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
