// src/app/nex-native/chat/first-visit/personalize/page.tsx
//
// Personalized Themes · honest "preview the idea" page · 2026-10-14.
//
// Reached from the first-visit page when a user taps "Personalized
// Themes". NEX does NOT currently implement user-uploaded or user-
// generated custom chat themes. The `custom` subscription-plan tag in
// thumbnail-entitlement.ts grants directory merchandising extras (24
// slots + featured + custom), not a chat-theme personalisation
// feature. There is no admin or user-facing upload path for personal
// chat themes outside /nex-native/admin/theme/new (admin-only).
//
// This page honours that honestly:
//   · explains what personalization will mean when it ships
//   · shows a small preview strip of EXISTING atmospheric themes so
//     the user can feel the range NEX already covers
//   · displays NO upload input, NO save button, NO "generate" button
//   · does NOT claim face-cover functionality (that term is undefined
//     in the codebase; see package-feature report §Section 5)
//   · does NOT imply biometric, facial recognition, image overlay, or
//     any other feature the code does not implement
//
// Entry criteria:
//   · Any signed-in NEX user (same gate as the first-visit page).
//   · Guests redirect to /welcome.
//
// This page does NOT change state. No cookie set, no DB write.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatIdentityHeader } from "@/lib/nex-native/chat-chrome/chat-identity-header";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { listActiveThemes } from "@/lib/nex-native/chat-theme-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  violet: "#9B6DFF",
  violetFaint: "rgba(155, 109, 255, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(139, 169, 209, 0.18)",
} as const;

export default async function FirstVisitPersonalizePage(): Promise<React.ReactElement> {
  const viewer = await resolveNexAppSessionOrGuest();
  if (viewer.kind !== "session") {
    redirect("/nex-native/welcome");
  }

  // Load the live catalogue · pick up to three themes with the most
  // distinct accent hues to showcase atmospheric range. If the
  // catalogue is unavailable we show the explainer without the
  // preview strip; we never fabricate themes.
  let atmospheric: Array<{
    id: string;
    name: string;
    accent_hex: string;
    tagline: string | null;
  }> = [];
  try {
    const all = await listActiveThemes();
    atmospheric = pickDistinctAtmospheric(all).slice(0, 3).map((t) => ({
      id: t.id,
      name: t.name,
      accent_hex: t.accent_hex,
      tagline: t.tagline,
    }));
  } catch {
    atmospheric = [];
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.textPrimary,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
      data-nex-surface="first-visit-personalize"
    >
      <header
        style={{
          position: "relative",
          flexShrink: 0,
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 12px 14px 20px",
          textShadow: "0 2px 20px rgba(0,0,0,0.75)",
        }}
      >
        <ChatIdentityHeader
          avatarUrl={null}
          displayName="Personalized Themes"
          subtitle="Preview the idea · coming soon"
          presenceKind="online"
          rightReserveWidth={0}
        />
      </header>

      <section
        style={{
          flex: 1,
          padding: "4px 16px 24px",
          maxWidth: 640,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          data-nex-first-visit-personalize-explainer
          role="status"
          style={{
            marginTop: 8,
            marginBottom: 16,
            padding: "16px",
            background: NEX.violetFaint,
            border: `1px solid ${NEX.violet}55`,
            borderRadius: 14,
            color: NEX.textPrimary,
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: NEX.violet }}>
            Personalization is on the way.
          </strong>{" "}
          Soon you'll be able to shape how NEX feels: your accent colour,
          your atmosphere, the mood that fits you. Right now, your most
          personal choice is picking from NEX's living themes · each one is a
          different world. Have a look.
        </div>

        {atmospheric.length > 0 ? (
          <div
            data-nex-first-visit-personalize-strip
            aria-label="Preview of atmospheric themes already in NEX"
          >
            <h3
              style={{
                margin: "4px 0 10px",
                fontSize: 13,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: NEX.textMuted,
                fontWeight: 700,
              }}
            >
              Three NEX atmospheres
            </h3>
            <ol
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              {atmospheric.map((t) => (
                <li
                  key={t.id}
                  data-nex-personalize-tile={t.id}
                  style={{
                    background: NEX.panel,
                    border: `1px solid ${NEX.borderStrong}`,
                    borderRadius: 14,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minHeight: 120,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      height: 48,
                      borderRadius: 10,
                      background: `radial-gradient(circle at 30% 30%, ${t.accent_hex}88, ${t.accent_hex}33 60%, transparent 100%)`,
                      border: `1px solid ${t.accent_hex}66`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: NEX.textPrimary,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.name}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              color: NEX.textMuted,
              fontSize: 13,
              border: `1px solid ${NEX.borderSoft}`,
              borderRadius: 14,
              background: NEX.panel,
            }}
            data-nex-first-visit-personalize-empty
          >
            Atmosphere previews aren't available right now. The themes
            library still has every live theme.
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            padding: "14px 16px",
            background: NEX.panel,
            border: `1px solid ${NEX.borderSoft}`,
            borderRadius: 14,
            color: NEX.textSecondary,
            fontSize: 13,
            lineHeight: 1.5,
          }}
          data-nex-first-visit-personalize-honesty
        >
          <strong style={{ color: NEX.textPrimary }}>What's not here yet.</strong>{" "}
          Uploading your own theme, saving a custom palette, or generating a
          theme from a photograph are not features of NEX right now. We'll
          tell you when they ship. Nothing on this page saves anything to
          your account.
        </div>

        <nav
          style={{
            marginTop: 20,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/nex-native/chat/first-visit"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${NEX.borderStrong}`,
              background: NEX.panel,
              color: NEX.textPrimary,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Back to welcome
          </Link>
          <Link
            href="/nex-native/chat-themes-library"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${NEX.cyan}66`,
              background: NEX.cyanFaint,
              color: NEX.cyan,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Open live Chat Themes →
          </Link>
          <Link
            href="/nex-native/chat"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "transparent",
              color: NEX.textMuted,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Continue to NEX Chat
          </Link>
        </nav>
      </section>
    </main>
  );
}

/**
 * Pick themes whose accent hues are maximally distinct. Pure
 * deterministic function · no I/O, no randomness. Keeps the preview
 * strip genuinely visually different rather than three near-identical
 * blues.
 */
function pickDistinctAtmospheric<T extends { accent_hex: string }>(
  themes: readonly T[],
): T[] {
  if (themes.length === 0) return [];
  // Order by hue bucket · greedy pick for the three widest-spaced hues.
  const withHue = themes.map((t) => ({
    t,
    hue: hueFromHex(t.accent_hex),
  }));
  const sorted = withHue.slice().sort((a, b) => a.hue - b.hue);
  if (sorted.length <= 3) return sorted.map((x) => x.t);
  // Pick 3 evenly-spaced indices along the hue-sorted array.
  const step = Math.floor(sorted.length / 3);
  return [sorted[0], sorted[step], sorted[step * 2]].map((x) => x.t);
}

function hueFromHex(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return h;
}
