// src/app/nexcorner/page.tsx
//
// NEX prelaunch · Nexcorner public landing page (RSC).
// Authored 2026-11-18.
//
// Content rules:
//   · Mobile-first (390 px viewport primary · desktop centred in sealed
//     phone frame · same chrome as /nex-generated/buying-guides).
//   · Honest copy only. No invented addresses, dates, or counts.
//   · The "Notify me at launch" email form is the primary CTA.
//   · Secondary section links to the six published buying guides that
//     already exist under /nex-generated/buying-guides and are on the
//     prelaunch public allowlist.
//   · Footer carries the verified legal-page links that currently exist
//     (/nex-native/privacy, /nex-native/terms). Both pages render with
//     a "pending review" banner · see HANDBACK caveats.
//
// This page is force-dynamic because the prelaunch feature flag is read
// at request time. Since the server action receives the flag check, the
// visible HTML does not actually change based on flag state · we always
// render the landing form. force-dynamic is kept to keep behaviour
// obvious if a future caveat line is wired to flag state.

import type { JSX } from "react";
import Link from "next/link";

import { NotifyAtLaunchForm } from "./_notify-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicGuide = {
  readonly slug: string;
  readonly title: string;
};

// Explicit, hand-curated list of the six published buying guides that
// are already under /nex-generated/buying-guides. We DO NOT read the
// manifest at build time because manifest rows can be added as drafts
// and we must not surface anything that is not currently published.
const PUBLIC_GUIDES: readonly PublicGuide[] = [
  { slug: "rolex", title: "Rolex Buying Guide" },
  { slug: "mobile-phones", title: "Mobile Phone Buying Guide" },
  { slug: "handbags", title: "Handbag Buying Guide" },
  { slug: "laptops", title: "Laptop Buying Guide" },
  { slug: "running-shoes", title: "Running Shoes Buying Guide" },
  { slug: "leather-wallets", title: "Leather Wallet Buying Guide" },
];

export default function NexcornerLandingPage(): JSX.Element {
  return (
    <div className="nx-stage">
      <main className="nx-frame" aria-labelledby="nexcorner-title">
        <span className="nx-eyebrow">Nexcorner</span>
        <h1 id="nexcorner-title" className="nx-title">
          Launching soon.
        </h1>
        <p className="nx-subtitle">
          Nexcorner is a small marketplace surface. We're not open yet. Leave
          your email and we'll tell you when it opens.
        </p>

        <NotifyAtLaunchForm />

        <h2 className="nx-section-title">Read while you wait</h2>
        <p className="nx-subtitle" style={{ marginBottom: 12 }}>
          Independent buying guides from the Nexcorner editorial team. Not
          affiliated with any brand mentioned.
        </p>
        <ul className="nx-guide-list">
          {PUBLIC_GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                className="nx-guide-link"
                href={`/nex-generated/buying-guides/${g.slug}`}
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>

        <footer className="nx-footer">
          <p>
            Nexcorner is a prelaunch surface. We only store the email address
            you submit above, for a single launch-notification message.
          </p>
          <nav className="nx-footer-links" aria-label="Footer">
            <Link href="/nex-native/privacy">Privacy</Link>
            <Link href="/nex-native/terms">Terms</Link>
            <Link href="/nex-generated/buying-guides">Buying guides</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
