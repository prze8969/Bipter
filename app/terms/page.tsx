import type { Metadata } from "next";
import { Doc, Section } from "@/components/doc";

export const metadata: Metadata = { title: "Terms & conditions · Bipter" };

export default function Terms() {
  return (
    <Doc title="Terms & conditions" intro="Effective 8 November 2026. By using Bipter you agree to these terms.">
      <Section title="A prototype on devnet">
        <p>
          Bipter is a hackathon prototype running on Solana <b>devnet</b>. All tokens (tUSDC and devnet SOL) are test tokens with <b>no monetary value</b>. Loans,
          installments and credit limits are a demonstration and are not real credit.
        </p>
      </Section>
      <Section title="No real purchases">
        <p>Products are demo listings. Nothing is sold, shipped or delivered. Amazon comparisons are illustrative snapshots, not offers.</p>
      </Section>
      <Section title="Not financial advice">
        <p>Nothing on Bipter is financial, investment, legal or tax advice. Do not use real funds or mainnet wallets with this prototype.</p>
      </Section>
      <Section title="Your wallet, your responsibility">
        <p>
          You are responsible for your wallet and for the transactions you approve. Blockchain transactions are public and cannot be reversed. Devnet may be reset by
          Solana at any time, which can erase balances and loans.
        </p>
      </Section>
      <Section title="No warranty">
        <p>
          Bipter is provided &ldquo;as is&rdquo;, without warranties of any kind. The program and app may contain bugs. To the extent permitted by law, the author is not
          liable for any loss arising from its use.
        </p>
      </Section>
      <Section title="Contact">
        <p>
          <a className="underline underline-offset-4" href="mailto:shewalepranav66@gmail.com">
            shewalepranav66@gmail.com
          </a>
        </p>
      </Section>
    </Doc>
  );
}
