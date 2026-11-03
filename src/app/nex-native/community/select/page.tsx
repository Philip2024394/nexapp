// src/app/nex-native/community/select/page.tsx
//
// Zone-selection + explicit confirmation. Users pick from a seeded list
// of local communities (Ireland counties) and tap "Confirm" to join.
// No auto-add.
//
// Owner directives:
//   · 2026-11-03 · dev-impersonation parity with contacts/page.tsx
//   · 2026-11-03 · "first we need desktop image and tablet ... then we
//                   need the page ui same color theme as our nex ireland
//                   app pallete". This file layers the sealed Ireland
//                   studio photo backdrop + dark frosted overlay (same
//                   pattern as ContactsShell) · and uses the Ireland
//                   world palette CSS vars (Emerald/Forest/Gold/Sage)
//                   with hex fallbacks.
//   · 2026-11-03 · "we don't need Indonesia · we are working on Ireland":
//                   zone labels use the plain name (no "Kecamatan" prefix)
//                   · emergency copy references 112 (EU-wide / Ireland
//                   standard) without naming a country.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { suggestZonesForOnboarding } from "@/lib/nex-native/community/zone-service";
import { NexPageHeader } from "../../_page-header";
import { confirmMembershipAction } from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ireland palette · all values resolve to `--nex-world-*` CSS vars at
// runtime with sealed hex fallbacks. Mirrors the Contacts page system
// so Ireland theming reads consistently across the app.
const IRELAND = {
  drawerBg: "var(--nex-world-drawer-bg, #123D2B)", // Emerald
  primary: "var(--nex-world-primary, #1B5138)", // Forest
  secondary: "var(--nex-world-secondary, #C6A15B)", // Gold
  primaryInk: "var(--nex-world-primary-ink, #AFC5B5)", // Sage
  backgroundBase: "var(--nex-world-background-base, #FAF8F4)", // Cream (unused on dark glass)
  textPrimary: "#F2F5F8",
  textMuted: "rgba(175, 197, 181, 0.72)",
  panel: "rgba(27, 81, 56, 0.55)", // Forest at 55% over the glass
  panelHover: "rgba(27, 81, 56, 0.75)",
  borderSoft: "rgba(198, 161, 91, 0.35)", // Gold tinted border
  borderGold: "var(--nex-world-secondary, #C6A15B)",
  danger: "#FF4D5E",
  success: "#16D66B",
};

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function SelectZonePage({ searchParams }: PageProps) {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");

  const [existing, zones] = await Promise.all([
    getMembershipForAccount(session.account.id),
    suggestZonesForOnboarding(),
  ]);
  const sp = await searchParams;
  const banner =
    sp.m === "left_community"
      ? { tone: "ok" as const, msg: "You left your community." }
      : sp.e
        ? { tone: "err" as const, msg: "Something went wrong — please try again." }
        : null;

  return (
    <>
      <style>{`
        html, body {
          background: ${IRELAND.drawerBg} !important;
        }
      `}</style>

      <main
        data-nex-community-select-root
        style={{
          position: "relative",
          minHeight: "100dvh",
          color: IRELAND.textPrimary,
          overflow: "hidden",
          isolation: "isolate",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* ===== Layer 1 · Responsive Ireland backdrop =====
              Owner directive 2026-11-03 · "the back ground desktop image
              i said". Owner-supplied Golden Hour Irish Village Panorama
              (landscape · 3MB) ships for desktop/tablet-landscape
              viewports · the sealed Ireland studio photo (portrait-
              friendly) stays for mobile. Native <picture> + media
              sources gives per-breakpoint selection in a single DOM
              element · browser picks the right source. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          <picture>
            {/* Desktop + tablet-landscape: Golden Hour Irish Village Panorama */}
            <source
              media="(min-width: 768px)"
              srcSet="/nex-ireland/village-panorama.png"
            />
            {/* Mobile fallback: existing Ireland studio photo */}
            <img
              src="/nex-brand/hq/ireland-studio.png"
              alt=""
              loading="eager"
              decoding="async"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                display: "block",
              }}
            />
          </picture>
        </div>

        {/* ===== Layer 2 · Dark frosted-glass overlay · same recipe as
              ContactsShell · dark Emerald tint + blur. ===== */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(5, 25, 15, 0.60) 0%, rgba(18, 61, 43, 0.72) 100%)",
            backdropFilter: "blur(22px) saturate(1.25)",
            WebkitBackdropFilter: "blur(22px) saturate(1.25)",
            zIndex: 1,
          }}
        />

        {/* ===== Layer 3 · Content column · responsive maxWidth with
              phone/tablet/desktop breakpoints. 480 phone · 640 small
              tablet · 720 large tablet + desktop. ===== */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            maxWidth: 720,
            margin: "0 auto",
            padding: "calc(env(safe-area-inset-top, 0) + 16px) 20px 48px",
          }}
        >
          {/* Owner directive 2026-11-03 · "the community page profile
              image is not loaded in header profile circle and the
              ping should always be green color". Pass the Ireland
              Community badge into the ping-badge primitive · pass
              NEX sealed presence-online green (#16D66B) as the
              accent so the pulsing halo + ring always read as green
              on every Community surface. */}
          <NexPageHeader
            dataScope="community-select"
            brandAvatarUrl="/nex-community/ireland-badge.png"
            brandAccent="#16D66B"
          />

          <header style={{ textAlign: "center", margin: "28px 0 24px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                color: IRELAND.textPrimary,
              }}
            >
              <span style={{ color: IRELAND.secondary }}>NEX</span>{" "}
              <span>Community Noticeboard</span>
            </h1>
            <p
              style={{
                margin: "12px auto 0",
                maxWidth: 520,
                fontSize: 14,
                color: IRELAND.primaryInk,
                lineHeight: 1.6,
                opacity: 0.9,
              }}
            >
              Pick your local community to see outages, road hazards and other
              neighbourhood notices. You can change this at any time.
            </p>
          </header>

          {banner && (
            <div
              role="status"
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                marginBottom: 16,
                background:
                  banner.tone === "ok"
                    ? "rgba(22, 214, 107, 0.10)"
                    : "rgba(255, 77, 94, 0.10)",
                border: `1px solid ${
                  banner.tone === "ok" ? `${IRELAND.success}66` : `${IRELAND.danger}66`
                }`,
                color: banner.tone === "ok" ? IRELAND.success : IRELAND.danger,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {banner.msg}
            </div>
          )}

          {existing && (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                marginBottom: 16,
                background: IRELAND.panel,
                border: `1px solid ${IRELAND.borderSoft}`,
                color: IRELAND.primaryInk,
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              You're currently connected to a community. Confirming a new one
              will replace your current selection.
            </div>
          )}

          {zones.length === 0 ? (
            <section
              style={{
                padding: "32px 24px",
                borderRadius: 16,
                background: IRELAND.panel,
                border: `1px solid ${IRELAND.borderSoft}`,
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: IRELAND.secondary,
                }}
              >
                No communities set up yet
              </h2>
              <p
                style={{
                  margin: "10px auto 0",
                  maxWidth: 440,
                  fontSize: 13,
                  color: IRELAND.primaryInk,
                  lineHeight: 1.6,
                  opacity: 0.85,
                }}
              >
                A NEX admin needs to add your local area. Check back soon or ask
                in NEX Chat.
              </p>
            </section>
          ) : (
            <form action={confirmMembershipAction}>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {zones.map((z, idx) => (
                  <li key={z.id}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        borderRadius: 14,
                        background: IRELAND.panel,
                        border: `1.5px solid ${IRELAND.borderSoft}`,
                        cursor: "pointer",
                        transition: "border-color 150ms ease, background 150ms ease",
                      }}
                    >
                      <input
                        type="radio"
                        name="hyperlocal_zone_id"
                        value={z.id}
                        defaultChecked={idx === 0}
                        required
                        style={{ accentColor: IRELAND.secondary }}
                      />
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: IRELAND.textPrimary,
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {formatZoneLabel(z.name, z.level, z.country)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <fieldset
                style={{
                  marginTop: 24,
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: IRELAND.panel,
                  border: `1px solid ${IRELAND.borderSoft}`,
                }}
              >
                <legend
                  style={{
                    padding: "0 8px",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    color: IRELAND.secondary,
                    textTransform: "uppercase",
                    fontWeight: 800,
                  }}
                >
                  Notifications
                </legend>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  {(
                    [
                      ["quiet", "Quiet — never notify me"],
                      ["urgent_only", "Urgent only — hazards + outages (recommended)"],
                      ["all", "All — notify me for every new notice"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      style={{
                        display: "flex",
                        gap: 10,
                        fontSize: 14,
                        color: IRELAND.primaryInk,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="notification_preference"
                        value={value}
                        defaultChecked={value === "urgent_only"}
                        style={{ accentColor: IRELAND.secondary }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <p
                style={{
                  marginTop: 16,
                  fontSize: 12,
                  color: IRELAND.primaryInk,
                  lineHeight: 1.6,
                  opacity: 0.75,
                }}
              >
                Community Noticeboard is for sharing non-emergency local
                information (outages, road hazards, weather alerts). It does{" "}
                <strong style={{ color: IRELAND.secondary, opacity: 1 }}>not</strong>{" "}
                replace emergency services. For emergencies dial{" "}
                <strong style={{ color: IRELAND.secondary, opacity: 1 }}>112</strong>.
              </p>

              <button
                type="submit"
                style={{
                  marginTop: 20,
                  width: "100%",
                  padding: "16px 24px",
                  borderRadius: 999,
                  background: IRELAND.secondary,
                  color: IRELAND.drawerBg,
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(10, 31, 21, 0.35)",
                  textTransform: "uppercase",
                }}
              >
                Confirm community
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}

/** Smart zone label. For Ireland counties (country IE · level=city) we
 *  show the plain name ("Dublin") · no "Kecamatan" prefix leaks in.
 *  For the historical Indonesia path we preserve the "Kecamatan {name}"
 *  prefix (code lives in prod data but the Ireland product doesn't
 *  surface it). */
function formatZoneLabel(name: string, level: string, country: string): string {
  if (country === "IE") return name;
  if (level === "kecamatan") return `Kecamatan ${name}`;
  return name;
}
