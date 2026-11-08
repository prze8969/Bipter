/* Invariant: for every verified product, our Pay-in-4 total < amazon_price + amazon_delivery.
 * Reports failures honestly. Never edit data to make this pass. */
import { products, productBreakdown, amazonTotal, formatUsdc } from "../lib/pricing";

type Row = Record<string, string>;
const rows: Row[] = [];
let failures = 0;
let verified = 0;

for (const p of products) {
  const b = productBreakdown(p);
  const a = amazonTotal(p);
  let result = "SKIP (not verified)";
  if (p.verified) {
    verified++;
    if (a == null) {
      result = "FAIL (verified but amazon fields null)";
      failures++;
    } else if (b.totalOwed < a) {
      result = `PASS (save ${formatUsdc(a - b.totalOwed)})`;
    } else {
      result = `FAIL (ours >= amazon by ${formatUsdc(b.totalOwed - a)})`;
      failures++;
    }
  }
  rows.push({
    id: p.id,
    our_total: formatUsdc(b.totalOwed),
    amazon_total: a == null ? "null" : formatUsdc(a),
    snapshot: p.amazon_snapshot_date ?? "null",
    result,
  });
}

console.table(rows);
console.log(`${products.length} products, ${verified} verified, ${failures} failing.`);
if (verified === 0) console.log("WARNING: no verified Amazon snapshots yet. Human must fill data/products.json.");
process.exit(failures > 0 ? 1 : 0);
