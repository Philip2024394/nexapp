// src/app/nex-native/hq/page.tsx
//
// Owner-authorised 2026-10-31 (round 4 · HQ repair task).
// Owner-authorised 2026-11-03 · Ireland-only consolidation ·
// Indonesia country card retired · worlds switcher deleted · the
// Ireland card's palette workspace link also retired (route gone).
// Preserved: Ireland card · appUrl deep-link to the live Ireland
// preview.
//
// - Server-rendered; `requireHqAdmin` gate (non-revealing 404 on deny).
// - Uses the sealed sidebar via hq/layout.tsx.

import { notFound } from "next/navigation";
import Image from "next/image";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";

export const dynamic = "force-dynamic";

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const ACCENT = "#00AFFF";
const BORDER = "rgba(0,175,255,0.14)";

type CountryCard = {
  readonly id: "ireland";
  readonly displayName: string;
  readonly subtitle: string;
  readonly worldId: "ireland";
  readonly image: string;
  readonly imageAlt: string;
  readonly ringColor: string;
  readonly appUrl: string;
};

// Owner-authorised 2026-10-31 (country-preview round) · country-card
// primary action now opens the LIVE deployed app (so founder lands
// inside Ireland/Indonesia experience auto-signed-in). The World
// Engine palette workspace remains as a secondary link.
const CARDS: readonly CountryCard[] = [
  {
    id: "ireland",
    displayName: "NEX IRELAND",
    subtitle: "Emerald · cream · gold",
    worldId: "ireland",
    image: "/nex-brand/hq/ireland-studio.png",
    imageAlt: "NEX Ireland · emerald + cream studio background",
    ringColor: "#1F8B4C",
    appUrl: "https://nex-ireland-preview.vercel.app/nex-native/contacts",
  },
];

export default async function HqHomePage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) notFound();
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) notFound();

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", color: INK }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          HQ · Home
        </div>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 900,
            margin: "6px 0 10px",
            letterSpacing: "0.01em",
          }}
        >
          NEX HEADQUARTERS
        </h1>
        <p
          style={{
            fontSize: 14.5,
            color: INK_DIM,
            lineHeight: 1.6,
            maxWidth: 720,
            margin: 0,
          }}
        >
          Select a country application to open its World Engine
          workspace. From there you can preview the country identity on
          your own device without changing what other users see.
          Deployment-derived identity remains the source of truth in
          production.
        </p>
      </header>

      <section
        aria-label="Country applications"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 22,
        }}
      >
        {CARDS.map((card) => (
          <CountryCardTile key={card.id} card={card} />
        ))}
      </section>

      <section
        aria-label="HQ context"
        style={{
          marginTop: 32,
          padding: "18px 20px",
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
          background: "#07152A",
          fontSize: 12.5,
          color: INK_DIM,
          lineHeight: 1.7,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 18,
        }}
      >
        <div>
          <div style={{ color: INK, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
            Signed in as
          </div>
          <code style={{ color: ACCENT, fontSize: 12.5 }}>
            {session.account.id}
          </code>
          <div style={{ marginTop: 4 }}>HQ role: admin</div>
        </div>
        <div>
          <div style={{ color: INK, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
            Boundaries
          </div>
          No migration apply · no deploy · no push from this surface.
          Changes to activate the identity globally are blocked by the
          two-apps doctrine.
        </div>
        <div>
          <div style={{ color: INK, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
            Next
          </div>
          Open Worlds for the preview engine. Open Harvest for the
          directory-pipeline status board.
        </div>
      </section>
    </div>
  );
}

function CountryCardTile({ card }: { card: CountryCard }): React.JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        border: `1px solid ${BORDER}`,
        aspectRatio: "4 / 3",
        background: "#061322",
        boxShadow: "0 20px 48px rgba(0,0,0,0.4)",
      }}
      className="nex-hq-country-card"
    >
      <Image
        src={card.image}
        alt={card.imageAlt}
        fill
        sizes="(min-width: 1100px) 560px, 90vw"
        priority
        style={{ objectFit: "cover" }}
      />
      {/* Bottom gradient legibility layer */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0) 55%, rgba(2,9,20,0.86) 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Hover ring */}
      <div
        aria-hidden
        className="nex-hq-country-card-ring"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          boxShadow: `inset 0 0 0 2px ${card.ringColor}`,
          opacity: 0,
          transition: "opacity 160ms ease",
          pointerEvents: "none",
        }}
      />
      {/* Caption + actions */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "22px 22px 20px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: INK_MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              marginBottom: 4,
            }}
          >
            Country app
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "0.02em",
              color: INK,
            }}
          >
            {card.displayName}
          </div>
          <div style={{ fontSize: 12.5, color: INK_DIM, marginTop: 2 }}>
            {card.subtitle}
          </div>
          {/* Owner directive 2026-11-03 · Ireland-only consolidation ·
              retired "Palette workspace →" link because the /hq/worlds
              switcher route was removed in the same pass. */}
        </div>
        <a
          href={card.appUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open live ${card.displayName} app in new tab`}
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 900,
            background: card.ringColor,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            textDecoration: "none",
          }}
        >
          Open app ↗
        </a>
      </div>
      <style>{`
        .nex-hq-country-card:hover { transform: translateY(-2px); box-shadow: 0 28px 60px rgba(0,0,0,0.55); transition: transform 160ms ease, box-shadow 160ms ease; }
        .nex-hq-country-card:hover .nex-hq-country-card-ring { opacity: 1; }
      `}</style>
    </div>
  );
}
