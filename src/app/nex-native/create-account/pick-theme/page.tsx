// src/app/nex-native/create-account/pick-theme/page.tsx
//
// Post-signup theme choice surface · Task #32 · 2026-10-11.
// --------------------------------------------------------
// After a successful signup the user lands here (unless they came
// through the account-wall intercept, which handles its own replay).
// They see the two free NEX-brand themes side-by-side and pick one,
// or skip to browse the full library, or defer entirely.
//
// Picks post to the sealed `updateChatThemeAction` with:
//   · chat_theme = "nex-bubbles" | "nex-flat"
//   · next = "/nex-native/create-account/welcome"
// The sealed action validates against the live catalogue + tier gate
// (both themes are gratis, so the gate is a no-op here) and the
// `next` param flows through its allow-listed redirect path.
//
// Skip paths:
//   · "Browse all themes →" · /nex-native/chat-themes-library
//   · "Decide later ·  skip →" · /nex-native/create-account/welcome
//     (goes to the add-to-home-screen flow sealed by Bridge 42)

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { updateChatThemeAction } from "../../_actions";
import { listLiveWorldsAsBrowserRows } from "../../chat-themes-library/_live-worlds-adapter";
import { NexPageHeader } from "../../_page-header";
import type { BrowserThemeRow } from "../../chat-themes-library/_theme-browser-client";
import {
  WELCOME_INTENT_COOKIE,
  isWelcomeIntent,
  pickThemeIntentCopy,
} from "../../welcome/_welcome-intent";
// Owner-authorised 2026-10-18 · S3 redirect chain · shop intent
// routes to the Face Cover picker, every other intent (including
// null, themes, personalised, tampered) keeps the sealed
// Add-to-Home-Screen landing. Pure helper from
// `_onboarding-destinations.ts`.
import { postThemePickDestination } from "../_onboarding-destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  textPrimary: "#F2F5F8",
  textSecondary: "#B5C3D6",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7200",
  orangeFaint: "rgba(255, 114, 0, 0.14)",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const NEX_FREE_IDS = ["nex-bubbles", "nex-flat"] as const;

export default async function PickThemePage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  // Owner-authorised intent persistence · 2026-10-15.
  // Read the welcome-intent cookie set when the user tapped one of
  // the three chat-NEX welcome cards. We surface it as a banner here
  // AND clear the cookie so it never applies twice. The pick-theme
  // behaviour (which free theme the user chooses) is UNCHANGED · the
  // banner is additive context, not a selection override.
  const cookieJar = await cookies();
  const rawIntent = cookieJar.get(WELCOME_INTENT_COOKIE)?.value ?? null;
  const intent = isWelcomeIntent(rawIntent) ? rawIntent : null;
  if (intent) {
    // Clear immediately so a user who revisits pick-theme via the
    // "Decide later · skip" path doesn't see the banner twice.
    cookieJar.delete(WELCOME_INTENT_COOKIE);
  }
  const intentCopy = intent ? pickThemeIntentCopy(intent) : null;
  // Owner-authorised 2026-10-18 · S3 · derive the post-theme-pick
  // destination from the intent that was JUST read above (before
  // the cookie clear at line 72). Shop intent routes to the Face
  // Cover picker; everything else preserves the sealed
  // Add-to-Home-Screen landing byte-for-byte.
  const nextStepHref = postThemePickDestination(intent);

  const liveRows = listLiveWorldsAsBrowserRows();
  const freeThemes = NEX_FREE_IDS.map((id) =>
    liveRows.find((r) => r.id === id),
  ).filter((r): r is BrowserThemeRow => !!r);

  const firstName =
    session.account.display_name?.split(/\s+/)[0] ??
    session.account.display_name ??
    null;

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
          padding: "calc(env(safe-area-inset-top, 0px) + 24px) 20px 48px",
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
              "radial-gradient(60% 40% at 50% 0%, rgba(0,175,255,0.09), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
          <NexPageHeader dataScope="post-signup-pick-theme" />

          <header style={{ margin: "16px 0 22px", textAlign: "center" }}>
            <div
              style={{
                fontSize: 10.5,
                letterSpacing: "0.26em",
                color: NEX.orange,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Welcome{firstName ? `, ${firstName}` : ""}
            </div>
            <h1
              style={{
                margin: "0 0 8px",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Pick your look.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: NEX.textSecondary,
                lineHeight: 1.55,
                maxWidth: 440,
                marginInline: "auto",
              }}
            >
              Every friend sees your theme when they open your chat.
              Two NEX looks come free. You can change any time.
            </p>
          </header>

          {/* Welcome-intent banner · surfaces the card the user tapped
              on /nex-native/welcome · owner-authorised intent
              persistence (2026-10-15). Additive context only · the
              theme-pick behaviour below is unchanged. Null when no
              intent cookie was set or the user signed up without
              going through welcome cards. */}
          {intentCopy && (
            <div
              role="status"
              data-nex-pick-theme-intent-banner
              data-nex-pick-theme-intent={intent ?? "none"}
              style={{
                margin: "0 auto 22px",
                maxWidth: 480,
                padding: "12px 14px",
                borderRadius: 12,
                background: NEX.cyanFaint,
                border: `1px solid ${NEX.cyanSoft}`,
                color: NEX.textPrimary,
                fontSize: 13,
                lineHeight: 1.5,
                textAlign: "left",
              }}
            >
              <strong
                style={{
                  display: "block",
                  color: NEX.cyan,
                  fontSize: 10.5,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                From your welcome choice
              </strong>
              {intentCopy}
            </div>
          )}

          <section
            aria-label="Free NEX themes"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
              marginBottom: 22,
            }}
          >
            {freeThemes.map((theme) => (
              <ThemeChoiceCard
                key={theme.id}
                theme={theme}
                nextStepHref={nextStepHref}
              />
            ))}
          </section>

          <div
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "0 auto 18px",
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX.textMuted,
              fontWeight: 700,
              maxWidth: 440,
            }}
          >
            <span
              style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }}
            />
            <span>Or</span>
            <span
              style={{ flex: 1, height: 1, background: `${NEX.textMuted}22` }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 440,
              marginInline: "auto",
            }}
          >
            <Link
              href="/nex-native/chat-themes-library"
              data-nex-pick-theme-browse
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                padding: "0 18px",
                borderRadius: 12,
                background: "transparent",
                color: NEX.cyan,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                border: `1px solid ${NEX.cyanSoft}`,
              }}
            >
              Browse all themes →
            </Link>
            <Link
              href={nextStepHref}
              data-nex-pick-theme-skip
              data-nex-pick-theme-skip-dest={nextStepHref}
              style={{
                textAlign: "center",
                padding: "10px 14px",
                color: NEX.textMuted,
                fontSize: 12.5,
                textDecoration: "underline",
              }}
            >
              Decide later · skip
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function ThemeChoiceCard({
  theme,
  nextStepHref,
}: {
  theme: BrowserThemeRow;
  nextStepHref: string;
}) {
  const accent = theme.accent_hex;
  const rim = theme.bubble_rim_hex ?? accent;
  const composer = theme.composer_rim_hex ?? accent;
  return (
    <form
      action={updateChatThemeAction}
      data-nex-pick-theme-card={theme.id}
      data-nex-pick-theme-card-dest={nextStepHref}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 18,
        borderRadius: 20,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.cyanSoft}`,
        overflow: "hidden",
      }}
    >
      <input type="hidden" name="chat_theme" value={theme.id} />
      <input type="hidden" name="next" value={nextStepHref} />
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(60% 40% at 50% 0%, ${accent}22, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        aria-hidden
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          borderRadius: 14,
          overflow: "hidden",
          background: theme.hero_image_url
            ? `url("${encodeURI(theme.hero_image_url)}") center/cover, ${accent}`
            : `linear-gradient(165deg, ${accent} 0%, ${rim} 55%, ${composer} 100%)`,
          border: `1px solid ${NEX.borderSoft}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "auto 12px 12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              padding: "6px 10px",
              borderRadius: 999,
              background: `${accent}cc`,
              color: "#021022",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            peer: hey 👋
          </div>
          <div
            style={{
              alignSelf: "flex-end",
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(2,9,20,0.72)",
              border: `1px solid ${rim}`,
              color: NEX.textPrimary,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            you: looks great
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: NEX.textPrimary,
            marginBottom: 4,
          }}
        >
          {theme.name}
        </div>
        {theme.tagline && (
          <div
            style={{
              fontSize: 12.5,
              color: NEX.textMuted,
              lineHeight: 1.5,
              marginBottom: 2,
            }}
          >
            {theme.tagline}
          </div>
        )}
        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginTop: 6,
          }}
        >
          Free · yours forever
        </div>
      </div>

      <button
        type="submit"
        data-nex-pick-theme-cta={theme.id}
        style={{
          position: "relative",
          minHeight: 44,
          padding: "0 18px",
          borderRadius: 12,
          background: NEX.orange,
          color: "#0a0608",
          fontSize: 14,
          fontWeight: 700,
          border: `1px solid ${NEX.orange}`,
          cursor: "pointer",
          boxShadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 10px 24px -14px ${NEX.orange}`,
        }}
      >
        {theme.name} →
      </button>
    </form>
  );
}
