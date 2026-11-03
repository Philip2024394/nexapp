// src/app/nex-native/community/create/page.tsx
//
// User creates a new local community under their county.
// Owner-authorised 2026-11-03 (D3b flow).
//
// The submission is HARD-GATED to the user's own county (we don't let
// a Dublin resident create a community under Cork). The submitter is
// auto-joined to the pending zone when the server action succeeds, so
// they can post immediately while HQ reviews.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { getZoneById } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { createUserCommunityAction } from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly searchParams: Promise<{ county?: string; e?: string }>;
}

const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)",
  secondary: "var(--nex-world-secondary, #C6A15B)",
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)",
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)",
  borderSoft: "rgba(198, 161, 91, 0.35)",
  danger: "#FF4D5E",
};

function errorBanner(code: string | undefined): string | null {
  switch (code) {
    case "bad_input":
      return "Please provide a community name.";
    case "invalid_name":
      return "That name doesn't form a valid community label. Try 2–80 letters.";
    case "already_pending":
      return "You already have a community submission waiting for review.";
    case "slug_taken":
      return "A community with a similar name already exists in your county. Try the discover page first.";
    case "parent_not_found":
      return "Your county couldn't be resolved. Please contact support.";
    case "db_error":
      return "Something went wrong. Try again in a moment.";
    default:
      return null;
  }
}

export default async function CreateCommunityPage({ searchParams }: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const { county: countyFromQuery, e: errCode } = await searchParams;

  // Prefer the explicit ?county= query, fall back to the user's
  // current membership county. If neither is set / usable, send the
  // user to discover so they can pick a county first.
  let countyZone = countyFromQuery ? await getZoneById(countyFromQuery) : null;
  if (!countyZone) {
    const myMem = await getMembershipForAccount(session.account.id);
    if (myMem) countyZone = await getZoneById(myMem.hyperlocal_zone_id);
  }
  if (!countyZone || countyZone.level !== "city") {
    redirect("/nex-native/community/discover?e=pick_county_first");
  }

  const banner = errorBanner(errCode);

  return (
    <>
      <style>{`html,body{background:${IRELAND.drawerBg} !important;}`}</style>
      <main
        data-nex-create-community
        style={{
          minHeight: "100dvh",
          background: IRELAND.drawerBg,
          color: IRELAND.textPrimary,
          padding: "calc(env(safe-area-inset-top,0) + 16px) 20px 48px",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <NexPageHeader
            dataScope="community-create"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          <header style={{ textAlign: "center", margin: "28px 0 20px" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
              Create your <span style={{ color: IRELAND.secondary }}>community</span>
            </h1>
            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 420,
                fontSize: 13,
                color: IRELAND.primaryInk,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              Add your local community under{" "}
              <strong style={{ color: IRELAND.secondary }}>{countyZone.name}</strong>.
              Your submission goes to NEX HQ for review · you'll be joined
              automatically so you can post straight away.
            </p>
          </header>

          {banner ? (
            <p
              role="alert"
              style={{
                margin: "0 0 16px",
                padding: "10px 14px",
                borderRadius: 10,
                background: "rgba(255,77,94,0.14)",
                border: `1px solid ${IRELAND.danger}66`,
                color: "#FDA4AF",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              {banner}
            </p>
          ) : null}

          <form
            action={createUserCommunityAction}
            style={{
              padding: 24,
              borderRadius: 16,
              background: IRELAND.panel,
              border: `1.5px solid ${IRELAND.borderSoft}`,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <input type="hidden" name="county_zone_id" value={countyZone.id} />

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: IRELAND.secondary,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Community name
              </span>
              <input
                type="text"
                name="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="e.g. Lacken, New Ross"
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(10,31,21,0.65)",
                  border: `1px solid ${IRELAND.borderSoft}`,
                  color: IRELAND.textPrimary,
                  fontSize: 15,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 11, color: IRELAND.textMuted }}>
                2–80 characters · letters, numbers, hyphens.
              </span>
            </label>

            <button
              type="submit"
              style={{
                marginTop: 6,
                padding: "14px 20px",
                borderRadius: 999,
                background: IRELAND.secondary,
                color: IRELAND.drawerBg,
                border: "none",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(10,31,21,0.35)",
              }}
            >
              Submit for review
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 11, color: IRELAND.textMuted, textAlign: "center" }}>
            <Link
              href="/nex-native/community/discover"
              style={{ color: IRELAND.secondary, textDecoration: "none", fontWeight: 700 }}
            >
              ← Back to discover
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
