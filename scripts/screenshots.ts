/* Screenshot every page at 390px and 1280px, run a simulated buy, and report console errors.
 * Usage: start the app (npm run start), then `npm run screenshots`. Output: ./screenshots (gitignored). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch();
  const errors: string[] = [];
  for (const width of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`[${width}] ${page.url()} ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`[${width}] ${page.url()} ${e.message}`));

    const shot = async (name: string) => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
    };

    await page.goto(BASE + "/");
    await page.getByRole("button", { name: "Add fake money" }).click();
    await page.getByText("+100 test USDC added").waitFor();
    await shot("dashboard");

    await page.goto(BASE + "/store");
    await shot("store");

    await page.goto(BASE + "/product/earbuds");
    await shot("product");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("button", { name: "Buy now, pay later" }).click();
    await shot("checkout-modal");
    await page.getByRole("button", { name: /Confirm and pay/ }).click();
    await page.waitForURL(/\/receipt\//);
    await shot("receipt");
    await page.getByRole("button", { name: /Fast-forward/ }).click();
    await page.getByRole("button", { name: "Collect next installment" }).click();
    await page.getByText("Active · 2/4").waitFor();
    await shot("receipt-after-collect");

    await page.goto(BASE + "/cart");
    await shot("cart");

    await page.goto(BASE + "/");
    await shot("dashboard-with-loan");
    await ctx.close();
  }
  await browser.close();
  console.log(`Screenshots in ./${OUT}`);
  console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n${errors.join("\n")}` : "No console errors.");
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
