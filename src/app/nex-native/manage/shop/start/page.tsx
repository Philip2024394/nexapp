// src/app/nex-native/manage/shop/start/page.tsx
//
// NEX Shop · Get Started landing.
// Owner-authorised 2026-11-06.
// -----------------------------------------------------------------------------
// First page the user hits when they tap "Shop" in the side drawer
// and don't yet own a business. Long centred container explaining
// the NEX chat+shop advantage (seconds-to-buyers vs search-away)
// followed by a single primary CTA that routes into the setup wizard.
//
// Behaviour:
//   · signed-out                       → redirect to /sign-in?next=/manage/shop/start
//   · signed-in, has a business        → redirect to /manage/shop/themes
//                                        (already onboarded · skip the landing)
//   · signed-in, no business yet       → paint the landing · CTA kicks
//                                        off the setup wizard

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const EMERALD = "var(--nex-world-primary, #123D2B)";
const FOREST = "var(--nex-world-forest, #1B5138)";
const GOLD = "var(--nex-world-secondary, #C6A15B)";
const CREAM = "var(--nex-world-cream, #FAF8F4)";
const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "rgba(5, 15, 28, 0.72)";
const BORDER = "rgba(198, 161, 91, 0.25)";
const BORDER_HI = "rgba(198, 161, 91, 0.55)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopStartPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/start");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  if (businesses[0]) {
    // Already onboarded · drop them straight into the picker.
    redirect("/nex-native/manage/shop/themes");
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-start
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Back />

          <Hero />

          <Advantages />

          <HowItWorks />

          <Guarantee />

          <Footer />
        </div>
      </main>
    </>
  );
}

// ─── Back link ───────────────────────────────────────────────────────
function Back(): React.JSX.Element {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Link
        href="/nex-native/free-chat"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          fontSize: 11,
          fontWeight: 700,
          color: GOLD,
          textDecoration: "none",
          border: `1px solid ${BORDER}`,
          borderRadius: 6,
        }}
      >
        ← Back to chat
      </Link>
    </nav>
  );
}

// ─── Hero · title + value prop + primary CTA ─────────────────────────
function Hero(): React.JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "22px 20px 26px",
        background: `linear-gradient(135deg, ${EMERALD} 0%, ${FOREST} 60%, rgba(2,9,20,0.95) 100%)`,
        border: `1px solid ${BORDER_HI}`,
        borderRadius: 18,
        textAlign: "center",
        boxShadow: "0 18px 46px rgba(0,0,0,0.55)",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          margin: "0 auto",
          padding: "4px 12px",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: GOLD,
          background: "rgba(198, 161, 91, 0.12)",
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 999,
        }}
      >
        NEX Shop · For Ireland
      </span>

      <h1
        style={{
          margin: 0,
          fontSize: 26,
          lineHeight: 1.1,
          fontWeight: 900,
          color: CREAM,
          letterSpacing: "-0.02em",
        }}
      >
        Open your shop.
        <br />
        Keep your chat.
        <br />
        <span style={{ color: GOLD }}>One account.</span>
      </h1>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: INK_DIM,
          maxWidth: 320,
          marginInline: "auto",
        }}
      >
        Every chat you have becomes a shop door. Customers are seconds
        away — not a search away.
      </p>

      <Link
        href="/nex-native/manage/shop/setup"
        data-nex-shop-start-cta
        style={{
          display: "inline-flex",
          alignSelf: "center",
          alignItems: "center",
          gap: 8,
          padding: "14px 26px",
          marginTop: 6,
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#1A120A",
          background: GOLD,
          textDecoration: "none",
          borderRadius: 999,
          boxShadow:
            "0 12px 26px rgba(198,161,91,0.25), 0 0 0 4px rgba(198,161,91,0.14)",
        }}
      >
        Create my shop →
      </Link>
      <span
        style={{
          fontSize: 10,
          color: INK_MUTED,
          letterSpacing: "0.05em",
        }}
      >
        Takes about 3 minutes · free to start
      </span>
    </section>
  );
}

// ─── Advantages · three pillar comparison ────────────────────────────
function Advantages(): React.JSX.Element {
  const pillars = [
    {
      emoji: "⚡",
      title: "Seconds, not searches",
      body:
        "On other platforms, buyers scroll past you. On NEX, your shop lives inside the chat they're already in · tap your name, you're open for business.",
    },
    {
      emoji: "🎭",
      title: "One identity, two voices",
      body:
        "Chat as yourself. Sell under a brand name. Both belong to you · neither interrupts the other · nothing shared without your say-so.",
    },
    {
      emoji: "📬",
      title: "Chat record stays yours",
      body:
        "Every customer conversation sits beside your shop · no third-party inbox, no lost thread when a buyer returns. Your record, your reply speed, your reputation.",
    },
  ];
  return (
    <section
      aria-label="NEX advantages"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <SectionHeading eyebrow="Why NEX" title="Nothing compares" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {pillars.map((p) => (
          <article
            key={p.title}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "14px 14px 16px",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
            }}
          >
            <span
              aria-hidden
              style={{
                flex: "0 0 auto",
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(198, 161, 91, 0.12)",
                border: `1px solid ${BORDER_HI}`,
                display: "grid",
                placeItems: "center",
                fontSize: 22,
              }}
            >
              {p.emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: CREAM,
                  letterSpacing: "-0.005em",
                }}
              >
                {p.title}
              </div>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: INK_DIM,
                }}
              >
                {p.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── How it works · 4 steps ──────────────────────────────────────────
function HowItWorks(): React.JSX.Element {
  const steps = [
    {
      n: "1",
      title: "Name your shop",
      body:
        "Choose a brand name — can be different from your chat name. This is what your customers see.",
    },
    {
      n: "2",
      title: "Add your story + address",
      body:
        "A short description, your city, your door · the things buyers look for before they tap Chat.",
    },
    {
      n: "3",
      title: "Set hours + policies",
      body:
        "Opening times, returns, delivery · shown to every buyer so you don't have to repeat it in chat.",
    },
    {
      n: "4",
      title: "Pick a template · go live",
      body:
        "Eleven shop templates, matching backgrounds, one tap to publish. Your shop opens to the world.",
    },
  ];
  return (
    <section
      aria-label="How it works"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <SectionHeading eyebrow="Process" title="How it works" />
      <ol
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {steps.map((s) => (
          <li
            key={s.n}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 14px 14px",
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
            }}
          >
            <span
              aria-hidden
              style={{
                flex: "0 0 auto",
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: GOLD,
                color: "#1A120A",
                display: "grid",
                placeItems: "center",
                fontSize: 15,
                fontWeight: 900,
              }}
            >
              {s.n}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: CREAM,
                  letterSpacing: "-0.005em",
                }}
              >
                {s.title}
              </div>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: INK_DIM,
                }}
              >
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Guarantee strip · trust signals ──────────────────────────────────
function Guarantee(): React.JSX.Element {
  const items = [
    { icon: "🇮🇪", text: "Built for Ireland" },
    { icon: "🛡", text: "NEX never handles payments" },
    { icon: "💬", text: "Free to open · pay only to promote" },
  ];
  return (
    <section
      aria-label="Guarantees"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "12px 14px",
        background: "rgba(5, 15, 28, 0.55)",
        border: `1px dashed ${BORDER}`,
        borderRadius: 14,
      }}
    >
      {items.map((i) => (
        <span
          key={i.text}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            color: CREAM,
            background: "rgba(198, 161, 91, 0.1)",
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            letterSpacing: "0.03em",
          }}
        >
          <span aria-hidden style={{ fontSize: 12 }}>
            {i.icon}
          </span>
          {i.text}
        </span>
      ))}
    </section>
  );
}

// ─── Footer · secondary CTA ──────────────────────────────────────────
function Footer(): React.JSX.Element {
  return (
    <footer
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        paddingTop: 10,
      }}
    >
      <Link
        href="/nex-native/manage/shop/setup"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#1A120A",
          background: GOLD,
          textDecoration: "none",
          borderRadius: 999,
        }}
      >
        Create my shop →
      </Link>
      <span style={{ fontSize: 10, color: INK_MUTED }}>
        You can skip any step · come back to finish any time.
      </span>
    </footer>
  );
}

// ─── Shared · small section heading ──────────────────────────────────
function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        paddingInline: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: GOLD,
        }}
      >
        {eyebrow}
      </span>
      <h2
        style={{
          margin: 0,
          fontSize: 17,
          fontWeight: 900,
          color: CREAM,
          letterSpacing: "-0.015em",
        }}
      >
        {title}
      </h2>
    </div>
  );
}
