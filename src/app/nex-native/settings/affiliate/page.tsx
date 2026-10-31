// src/app/nex-native/settings/affiliate/page.tsx
//
// NEX Settings · Affiliate programme explainer. Shown to users who
// haven't joined the Affiliate Network yet · pitched at "I have no
// products to sell but I want to earn on NEX".
//
// Already-joined users are bounced to the dashboard · this page is
// explainer-only. The actual join action lives at /affiliate/join.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isAffiliateAccount } from "@/lib/nex-native/affiliate-service";
import { NexPageHeader } from "../../_page-header";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "#03101D",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.12)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  green: "#8FFF6E",
  borderSoft: "rgba(255, 255, 255, 0.06)",
};

interface Step {
  n: string;
  title: string;
  body: string;
}

const HOW_IT_WORKS: Step[] = [
  {
    n: "1",
    title: "Join the network",
    body: "Accept the programme terms. No upfront cost · no inventory · no fulfilment to manage.",
  },
  {
    n: "2",
    title: "Browse the marketplace",
    body: "Local merchants list products that need promoters. You pick what fits the people you talk to on NEX.",
  },
  {
    n: "3",
    title: "Share your personal link",
    body: "Each product gets a tracked link tied to your account. Share it in chats, your profile, or on the open web.",
  },
  {
    n: "4",
    title: "Earn commission on paid orders",
    body: "When someone buys through your link and the order is confirmed by the merchant, you earn commission on that sale.",
  },
];

const WHO_ITS_FOR: string[] = [
  "You spend time on NEX but don't sell anything yourself",
  "Friends ask you for recommendations and you already share them",
  "You run a community page, group, or audience outside NEX",
  "You want a side income without inventory, shipping, or support work",
];

export default async function AffiliateExplainerPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  if (await isAffiliateAccount(session.account.id).catch(() => false)) {
    redirect("/nex-native/affiliate");
  }

  return (
    <>
      <style>{`html,body{background:${NEX.bg} !important;}`}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.textPrimary,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(60% 40% at 50% 0%, rgba(255,114,0,0.08), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
          <NexPageHeader dataScope="settings-affiliate-explainer" />

          <nav style={{ margin: "20px 0 12px" }}>
            <Link
              href="/nex-native/settings"
              style={{
                color: NEX.textMuted,
                textDecoration: "none",
                fontSize: 12.5,
              }}
            >
              ← Back to settings
            </Link>
          </nav>

          <header style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.22em",
                color: NEX.orange,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              NEX Affiliate Network
            </div>
            <h1
              style={{
                margin: "0 0 10px",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.015em",
              }}
            >
              No products to sell? Earn with recommendations.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14.5,
                color: NEX.textSecondary,
                lineHeight: 1.55,
              }}
            >
              The Affiliate Network is NEX's way of paying people who bring
              buyers to local merchants. You don't need inventory, a shop, or
              shipping — just an audience, a chat, or a recommendation.
            </p>
          </header>

          <section
            aria-label="Who it's for"
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: NEX.panel,
              border: `1px solid ${NEX.borderSoft}`,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Who it's for
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {WHO_ITS_FOR.map((line, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    fontSize: 13.5,
                    color: NEX.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      flex: "none",
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: NEX.cyan,
                      marginTop: 7,
                    }}
                  />
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="How it works" style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: NEX.textMuted,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 10,
                padding: "0 2px",
              }}
            >
              How it works
            </div>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 10,
              }}
            >
              {HOW_IT_WORKS.map((step) => (
                <li
                  key={step.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr",
                    gap: 14,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: NEX.panel,
                    border: `1px solid ${NEX.borderSoft}`,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      background: NEX.orangeFaint,
                      color: NEX.orange,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      border: `1px solid ${NEX.orange}44`,
                    }}
                  >
                    {step.n}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 700,
                        color: NEX.textPrimary,
                        marginBottom: 4,
                      }}
                    >
                      {step.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: NEX.textSecondary,
                        lineHeight: 1.55,
                      }}
                    >
                      {step.body}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-label="What it costs"
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: `linear-gradient(180deg, ${NEX.panelHi}, ${NEX.panel})`,
              border: `1px solid ${NEX.cyan}44`,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: NEX.cyan,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              What it costs you
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: NEX.textSecondary,
                lineHeight: 1.55,
              }}
            >
              Nothing upfront. No subscription. No minimum sales. You only
              earn when a buyer completes an order through your link —
              merchants fund the commission out of their sale, not you.
            </p>
          </section>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/nex-native/affiliate/join"
              style={{
                flex: "1 1 220px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 20px",
                borderRadius: 12,
                background: NEX.orange,
                color: "#0a0608",
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                border: `1px solid ${NEX.orange}`,
                boxShadow: `0 1px 0 rgba(255,255,255,0.15) inset, 0 10px 24px -14px ${NEX.orange}`,
              }}
            >
              Join the Affiliate Network →
            </Link>
            <Link
              href="/nex-native/affiliate/marketplace"
              style={{
                flex: "1 1 180px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 20px",
                borderRadius: 12,
                background: "transparent",
                color: NEX.cyan,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              Browse marketplace first
            </Link>
          </div>

          <p
            style={{
              marginTop: 18,
              fontSize: 11.5,
              color: NEX.textMuted,
              lineHeight: 1.55,
            }}
          >
            You can leave the programme at any time. Pending commissions
            keep processing on their normal schedule after you leave.
          </p>
        </div>
      </main>
    </>
  );
}
