// src/app/nex-native/creator/join/page.tsx
//
// NEX Creator · "Join the programme" entry page. Owner directive 2026-11-04
// · Phase U Option A.
//
// Distinct from the sealed /nex-native/creator dashboard (which serves
// signed-in creators showing badge progress). This route is the funnel
// entry for prospective creators arriving from:
//   · the drawer "Creator membership" row
//   · the profile-edit "Unlock Creator tools" inline card
//   · direct link sharing
//
// Phase U: no Stripe calls. "Choose your plan →" routes to
// /creator/subscribe which shows the €4.99/€49 pricing with placeholder
// Checkout. Preserves the HOLD on all Payments integration.

import Link from "next/link";
import { NexPageHeader } from "../../_page-header";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getAccountById } from "@/lib/nex-native/account-service";
import { EarningsFlipCard } from "./_earnings-flip-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ from?: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  primary: "var(--nex-world-primary, #1B5138)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  success: "#16D66B",
};

// Owner directive 2026-11-04 later-same-day (third pass). The 8 bullets +
// Creator monetisation details now live inside <EarningsFlipCard /> ·
// a client component with a 3D flip revealing the rates + cancellation
// rules. Front and back content live in `_earnings-flip-card.tsx`.

// Owner directive 2026-11-04 · post-save redirect lands here. The `from`
// param controls both the success banner (when non-null) and where the
// "Set up later" skip link routes (to a reasonable next landing).
function skipDestination(from: string | undefined): string {
  if (from === "profile-saved" || from === "signup-saved") {
    return "/nex-native/free-chat";
  }
  return "/nex-native/settings/profile/edit";
}

export default async function CreatorJoinPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await resolveSessionWithDevOverride();
  const account = session ? await getAccountById(session.account.id) : null;
  const nexHandle = account?.nex_handle ?? null;
  const showSavedBanner = sp.from === "profile-saved" || sp.from === "signup-saved";
  const skipHref = skipDestination(sp.from);

  return (
    <main
      data-nex-creator-join
      style={{
        minHeight: "100dvh",
        background: IRELAND.drawerBg,
        color: IRELAND.textPrimary,
        padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 60px",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <NexPageHeader
          dataScope="creator-join"
          hideSearch
          brandSlot={
            nexHandle ? (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: IRELAND.secondary,
                  letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}
                aria-label={`Your NEX ID is ${nexHandle}`}
              >
                {nexHandle.charAt(0).toUpperCase() + nexHandle.slice(1)}
              </span>
            ) : null
          }
        />

        {/* Post-save success banner · owner directive 2026-11-04. Appears when
            the user arrives from a profile save (from=profile-saved) or from a
            first-save-after-signup (from=signup-saved). Confirms the save
            landed before pivoting into the Creator funnel. */}
        {showSavedBanner ? (
          <section
            role="status"
            data-nex-creator-join-saved-banner
            style={{
              margin: "16px 0 4px",
              padding: "14px 16px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${IRELAND.success}14, ${IRELAND.secondary}18)`,
              border: `1px solid ${IRELAND.success}66`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: "50%",
                background: IRELAND.success,
                color: IRELAND.drawerBg,
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              ✓
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: IRELAND.textPrimary }}>
                Profile saved · linked to your NEX account
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: IRELAND.primaryInk,
                  opacity: 0.85,
                  lineHeight: 1.45,
                }}
              >
                Here's the NEX Creator programme · optional · set up now or later.
              </span>
            </span>
          </section>
        ) : null}

        <header style={{ textAlign: "center", margin: "28px 0 20px" }}>
          <div
            aria-hidden
            style={{
              fontSize: 48,
              lineHeight: 1,
              color: IRELAND.secondary,
              filter: `drop-shadow(0 6px 20px ${IRELAND.secondary}33)`,
            }}
          >
            ☘
          </div>
          <h1
            style={{
              margin: "14px 0 0",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.01em",
            }}
          >
            NEX Creator
          </h1>
          <p
            style={{
              margin: "10px auto 0",
              maxWidth: 440,
              fontSize: 14,
              color: IRELAND.primaryInk,
              lineHeight: 1.55,
              opacity: 0.95,
            }}
          >
            Turn your presence into income. Keep 100% of what your fans give you.
          </p>
        </header>

        {/* Owner directive 2026-11-04 later-same-day (seventh pass) ·
            flip card restored · Front holds "Earn from what you love" ·
            Back holds the full Creator monetisation details (membership
            price · earnings streams · sponsorship rates · cancellation).
            CTAs live OUTSIDE the flip so they're always reachable
            regardless of flip state. */}
        <EarningsFlipCard />

        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Link
            href="/nex-native/creator/subscribe"
            data-nex-creator-primary-cta
            style={{
              display: "block",
              padding: "14px 20px",
              borderRadius: 999,
              background: IRELAND.secondary,
              color: IRELAND.drawerBg,
              textDecoration: "none",
              textAlign: "center",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              boxShadow: `0 4px 14px ${IRELAND.secondary}33`,
            }}
          >
            Choose your plan →
          </Link>
          <Link
            href={skipHref}
            style={{
              display: "block",
              padding: "10px 16px",
              textAlign: "center",
              color: IRELAND.primaryInk,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
              opacity: 0.9,
            }}
          >
            Set up later →
          </Link>
        </div>

        <p
          style={{
            margin: "24px auto 0",
            maxWidth: 440,
            fontSize: 11,
            color: IRELAND.textMuted,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          0% NEX commission on Creator earnings. Stripe or PayPal processing
          fees may still apply · charged by the payment provider, not NEX.
        </p>
      </div>
    </main>
  );
}
