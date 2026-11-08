/* Screenshot every page in light + dark at 390px and 1280px and report console errors.
 * Playwright has no wallet extension, so pages are captured in the not-connected state.
 * Usage: npm run start (or dev), then `npm run screenshots`. Output: ./screenshots (gitignored). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES: [string, string][] = [
  ["dashboard", "/"],
  ["store", "/store"],
  ["product", "/product/mech-keyboard"],
  ["cart", "/cart"],
  ["receipt", "/receipt/11111111111111111111111111111111"],
];

async function main() {
  const browser = await chromium.launch();
  const errors: string[] = [];
  let n = 0;
  for (const theme of ["light", "dark"] as const) {
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme });
      await ctx.addInitScript((t) => {
        localStorage.setItem("bipter.theme", t);
        localStorage.setItem("bipter.cart.v1", JSON.stringify([{ productId: "earbuds", qty: 1, plan: "full" }, { productId: "backpack", qty: 1, plan: "pay4" }]));
      }, theme);
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && errors.push(`[${theme} ${width}] ${page.url()} ${m.text()}`));
      page.on("pageerror", (e) => errors.push(`[${theme} ${width}] ${page.url()} ${e.message}`));
      for (const [name, path] of PAGES) {
        await page.goto(BASE + path, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${name}-${theme}-${width}.png`, fullPage: true });
        n++;
      }
      // checkout modal (shows connect prompt without a wallet)
      await page.goto(BASE + "/product/mech-keyboard", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Buy now, pay later" }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/checkout-${theme}-${width}.png` });
      n++;
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${n} screenshots in ./${OUT}`);
  console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n${errors.join("\n")}` : "No console errors.");
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
