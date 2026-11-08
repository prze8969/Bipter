import type { Metadata } from "next";
import { Doc, Section } from "@/components/doc";

export const metadata: Metadata = { title: "Privacy policy · Bipter" };

export default function Privacy() {
  return (
    <Doc title="Privacy policy" intro="Effective 8 November 2026. Bipter is a hackathon prototype on Solana devnet. We collect as little as possible.">
      <Section title="No accounts">
        <p>There is no sign-up, password or profile. You connect your own wallet; we never see or store its private keys or recovery phrase.</p>
      </Section>
      <Section title="What we process">
        <ul className="grid list-disc gap-2 pl-5">
          <li>
            <b>Your public wallet address</b>, to read your balances and loans from the blockchain, and when you ask for test tokens (our server receives the address to
            send them).
          </li>
          <li>
            <b>Blockchain data.</b> Transactions you sign are public on Solana devnet and visible on block explorers. We cannot delete them.
          </li>
          <li>
            <b>Browser storage</b> on your device only: theme, display currency, cart and loan labels. Clear your site data to remove them.
          </li>
        </ul>
      </Section>
      <Section title="Third parties">
        <ul className="grid list-disc gap-2 pl-5">
          <li>Solana devnet RPC providers, which receive the requests your browser makes to read the chain.</li>
          <li>open.er-api.com, for display-only exchange rates. No personal data is sent.</li>
          <li>Your wallet provider (for example Phantom), under its own privacy policy.</li>
        </ul>
        <p>We do not use analytics, advertising or tracking cookies, and we do not sell data.</p>
      </Section>
      <Section title="Contact">
        <p>
          Questions:{" "}
          <a className="underline underline-offset-4" href="mailto:shewalepranav66@gmail.com">
            shewalepranav66@gmail.com
          </a>
        </p>
      </Section>
    </Doc>
  );
}
