import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Doc, Section, Table } from "@/components/doc";

export const metadata: Metadata = { title: "Help & troubleshooting · Bipter" };

const PROGRAM = process.env.NEXT_PUBLIC_PROGRAM_ID;
const MINT = process.env.NEXT_PUBLIC_USDC_MINT;
const MERCHANT = process.env.NEXT_PUBLIC_MERCHANT;
const ex = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all underline underline-offset-4">
      {children}
    </a>
  );
}

function Ok({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CheckCircle2 size={15} className="text-ok" /> {children}
    </span>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <AlertTriangle size={15} className="text-accent" /> {children}
    </span>
  );
}

export default function Help() {
  const contracts: [React.ReactNode, React.ReactNode][] = [];
  if (PROGRAM) contracts.push(["Bipter program", <A key="p" href={ex(PROGRAM)}>{PROGRAM}</A>]);
  if (MINT) contracts.push(["tUSDC mint", <A key="m" href={ex(MINT)}>{MINT}</A>]);
  if (MERCHANT) contracts.push(["Demo merchant", <A key="d" href={ex(MERCHANT)}>{MERCHANT}</A>]);

  return (
    <Doc title="Help & troubleshooting" intro="Connect a wallet, get test money, and understand what your wallet shows you.">
      <Section id="wallets" title="Supported wallets">
        <Table
          head={["Wallet", "Status"]}
          rows={[
            [<Ok key="p">Phantom</Ok>, "Recommended. Tested end to end."],
            [<Ok key="s">Solflare</Ok>, "Supported."],
            [
              <Warn key="m">MetaMask (Solana)</Warn>,
              "Experimental. Its Solana snap has crashed during checkout (“Snap … terminated”). Nothing is charged when that happens. Use Phantom.",
            ],
          ]}
        />
      </Section>

      <Section id="devnet" title="Switch your wallet to devnet">
        <ol className="grid list-decimal gap-2 pl-5">
          <li>
            Phantom: Settings → Developer Settings → Testnet Mode → on, then pick <b>Solana Devnet</b>.
          </li>
          <li>
            Solflare: Settings → General → Network → <b>Devnet</b>.
          </li>
          <li>
            Reload Bipter and press <b>Connect wallet</b>.
          </li>
        </ol>
      </Section>

      <Section id="money" title="Get test money">
        <ol className="grid list-decimal gap-2 pl-5">
          <li>
            <b>Get devnet SOL</b> (dashboard): 0.2 SOL for network fees, while our sponsor wallet has some. Otherwise use{" "}
            <A href="https://faucet.solana.com">faucet.solana.com</A>.
          </li>
          <li>
            <b>Add fake money</b> (dashboard): mints 100 <b>Bipter Test USD (tUSDC)</b>. One request per 30 seconds.
          </li>
        </ol>
        <p>Both are devnet test tokens with no real value.</p>
      </Section>

      <Section id="warnings" title="Why does my wallet say “unsafe”?">
        <p>When you pay in 4, your wallet shows warnings. They are expected. Here is what each one means.</p>
        <Table
          head={["Wallet says", "What it means"]}
          rows={[
            [
              "“You are allowing this dApp to withdraw funds from your account in the future”",
              "This is the capped approval that lets installments 2 to 4 be collected automatically. Only the Bipter pool can use it, one installment at a time, when it is due.",
            ],
            [
              "“Approve to transfer up to …”",
              "Exactly 3 × your installment, nothing more. You can revoke it in your wallet at any time; the remaining installments would then not be collected.",
            ],
            ["“− … tUSDC” or “Unknown”", "Your first installment, paid today in Bipter Test USD. Older wallet caches may still say Unknown."],
            ["“− 0.002 SOL”", "Mostly a one-time deposit to create your loan record on-chain, plus a network fee of about 0.000005 SOL."],
            [
              "“Confirm (unsafe)” or a red banner",
              "Wallets flag apps they have not reviewed, especially ones that ask for an approval. This is a devnet prototype; no real money is involved.",
            ],
          ]}
        />
      </Section>

      <Section id="errors" title="Common problems">
        <Table
          head={["Problem", "Fix"]}
          rows={[
            ["“Not enough devnet SOL for network fees”", "Press Get devnet SOL, or use faucet.solana.com."],
            ["“Installment not due yet”", "Wait for the countdown, or press Fast-forward (demo) on the receipt."],
            ["“Over credit limit”", "Your limit starts at 100 tUSDC and grows by 25 with each repaid loan."],
            ["“rate limit”, 429, slow pages", "The free public devnet RPC is busy. Wait a few seconds and retry."],
            ["Balances show 0 after connecting", "Make sure the wallet is on devnet, not mainnet."],
            ["“Snap … terminated” (MetaMask)", "MetaMask’s Solana support crashed. Nothing was charged. Use Phantom."],
          ]}
        />
      </Section>

      <Section id="real-vs-mocked" title="What is real and what is mocked">
        <Table
          head={["Part", "Status"]}
          rows={[
            ["Money", "Bipter Test USD (tUSDC): our own SPL token on devnet, 6 decimals, no real value."],
            ["Wallet", "Your own Phantom or Solflare wallet on devnet."],
            ["Loans, installments, credit limit", "The Bipter program on Solana devnet, read from on-chain accounts."],
            ["Network fees", "Paid in devnet SOL by your wallet."],
            ["Products and delivery", "Demo listings. Nothing ships."],
            ["Amazon comparison", "Dated snapshot with a source link, illustrative. Hidden until verified."],
            ["Local currency", "Display only, from an FX rate. Everything settles in tUSDC."],
            ["Loan labels", "Product names on receipts are stored in your browser; all amounts come from chain."],
          ]}
        />
      </Section>

      {contracts.length > 0 && (
        <Section id="contracts" title="On-chain addresses (devnet)">
          <Table head={["Account", "Address"]} rows={contracts} />
        </Section>
      )}

      <Section title="Still stuck?">
        <p>
          Email <A href="mailto:shewalepranav66@gmail.com">shewalepranav66@gmail.com</A> or reach out on{" "}
          <A href="https://github.com/prze8969">GitHub</A>.
        </p>
      </Section>
    </Doc>
  );
}
