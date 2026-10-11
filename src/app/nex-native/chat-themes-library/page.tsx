// src/app/nex-native/chat-themes-library/page.tsx
//
// NEX Space · theme library landing · redesigned 2026-10-11 (Task #34).
// --------------------------------------------------------------------
// This surface is now a proper discovery entry point:
//
//   1. "NEX Space" header · 1-line value prop
//   2. Compact trial-status chip (session only) · replaces the big
//      banner · trial state is still visible but no longer dominates
//   3. "Featured for you" hero card · ONE theme matched to the
//      viewer's business industry if set, falling back to the NEX
//      brand default when no hint is available
//   4. "Popular" strip · hand-picked polished themes · horizontal
//      scroll on mobile, wraps to grid on desktop
//   5. Category grid under a "Browse by family" divider · the sealed
//      phone-frame tile landing
//   6. Guest sign-up invitation card at the bottom (unchanged · still
//      renders only for guests)
//
// Guest + session both paint sections 1 · 3 · 4 · 5. Session paints
// 2 · 6 as session-only. Guests see section 6.
//
// URL renamed 2026-10-04 · was /nex-native/settings/theme ·
// old URL still 301s to this location (see next.config.mjs redirects).
//
// Doctrine · doctrine_theme_ownership_2026_09_27.md.

import Link from "next/link";
import { startThemesTrialAction } from "../_actions";
import { CategoryGrid } from "./_category-grid";
import { loadLibraryData } from "./_load-library-data";
import { loadLibraryDataAsGuest } from "./_load-library-data-guest";
import { themePreviewHref } from "./_theme-preview-href";
import { NexPageHeader } from "../_page-header";
import { resolveNexAppSessionOrGuest } from "@/lib/nex-native/app/session-or-guest";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { themeCategoryIdForBusinessCategory } from "@/lib/nex-native/theme-category/industry-order";
import type { BrowserThemeRow } from "./_theme-browser-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#071525",
  panelHi: "#0A1A2D",
  cyan: "#00AFFF",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  orange: "#FF7800",
  orangeFaint: "rgba(255, 120, 0, 0.14)",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  borderSoft: "rgba(255, 255, 255, 0.07)",
};

const SUCCESS_CODES = new Set(["theme_updated"]);

export default async function ThemePickerPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; m?: string }>;
}) {
  const viewer = await resolveNexAppSessionOrGuest();
  const isGuest = viewer.kind === "guest";

  const data = isGuest ? null : await loadLibraryData();
  const guestData = isGuest ? await loadLibraryDataAsGuest() : null;

  const browserThemes = isGuest
    ? guestData!.browserThemes
    : data!.kind === "ok"
      ? data!.browserThemes
      : [];

  // Industry-first ordering · session viewers only. Guests see the
  // sealed registry order so the first-time experience stays
  // deterministic.
  let preferredCategoryId: string | null = null;
  if (!isGuest) {
    try {
      const owned = await listBusinessesByOwner(viewer.session.account.id);
      const primary = owned[0];
      if (primary) {
        preferredCategoryId = themeCategoryIdForBusinessCategory(
          primary.business_category,
        );
      }
    } catch {
      // Non-fatal · fall through to the sealed order.
    }
  }

  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  return (
    <>
      <style>{`
        html, body { background: ${NEX.bg} !important; }
      `}</style>
      <main
        style={{
          minHeight: "100dvh",
          background: NEX.bg,
          color: NEX.text,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          padding: "20px 16px 40px",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <NexPageHeader dataScope="settings-theme" />

            <header style={{ margin: "18px 0 20px" }}>
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.26em",
                  color: NEX.cyan,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                NEX Space
              </div>
              <h1
                style={{
                  margin: "6px 0 4px",
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                }}
              >
                Make this chat yours.
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: NEX.textDim,
                  lineHeight: 1.55,
                }}
              >
                Every friend sees your theme when they open your chat.
                Pick a free NEX look or explore every family below.
              </p>
            </header>

            {banner && (
              <div
                role="status"
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: isSuccess
                    ? "rgba(22,214,107,0.14)"
                    : "rgba(255,120,0,0.14)",
                  border: `1px solid ${
                    isSuccess ? "rgba(22,214,107,0.5)" : "rgba(255,120,0,0.5)"
                  }`,
                  color: NEX.text,
                  fontSize: 12,
                }}
              >
                {isSuccess
                  ? `Theme saved · ${banner.message}`
                  : banner.message}
              </div>
            )}

          </div>

          <FreeNexPhonePair themes={browserThemes} isGuest={isGuest} />

          <section
            aria-label="Free trial 7 days"
            style={{ maxWidth: 720, margin: "0 auto 20px" }}
          >
            <FreeTrialSevenDaysCard />
          </section>

          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <SectionDivider label="Chat Themes" accentColor={NEX.cyan} />
          </div>

          <CategoryGrid
            browserThemes={browserThemes}
            preferredCategoryId={preferredCategoryId}
          />

          {isGuest && (
            <div
              data-nex-themes-guest-invite
              style={{
                maxWidth: 720,
                margin: "32px auto 0",
                padding: "18px 20px",
                borderRadius: 14,
                background:
                  "linear-gradient(180deg, rgba(0,175,255,0.08) 0%, rgba(3,16,29,0.72) 100%)",
                border: `1px solid ${NEX.cyanSoft}`,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.22em",
                  color: NEX.cyan,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Make this chat yours
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: NEX.text,
                  lineHeight: 1.35,
                }}
              >
                Pick any theme · we'll save it to your account.
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: NEX.textDim,
                  lineHeight: 1.55,
                  maxWidth: 480,
                  margin: "0 auto",
                }}
              >
                Free NEX account · 15 seconds · no card needed. Tap a
                category above to see every theme up close.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/nex-native/create-account"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 20px",
                    borderRadius: 10,
                    background: NEX.orange,
                    color: "#0a0608",
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: "none",
                    border: `1px solid ${NEX.orange}`,
                  }}
                >
                  Create free account →
                </Link>
                <Link
                  href="/nex-native/sign-in"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "10px 20px",
                    borderRadius: 10,
                    background: "transparent",
                    color: NEX.cyan,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    border: `1px solid ${NEX.cyanSoft}`,
                  }}
                >
                  Already have one? Sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}


// ─── Section divider ───────────────────────────────────────────────

function SectionDivider({
  label,
  accentColor,
}: {
  label: string;
  accentColor: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "4px 0 14px",
        fontSize: 10.5,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: accentColor,
        fontWeight: 700,
      }}
    >
      <span style={{ flex: 1, height: 1, background: `${accentColor}22` }} />
      <span>{label}</span>
      <span style={{ flex: 1, height: 1, background: `${accentColor}22` }} />
    </div>
  );
}

// ─── Two free NEX-brand mini phones (NEX Original + NEX New) ────────

function FreeNexPhonePair({
  themes,
  isGuest,
}: {
  themes: ReadonlyArray<BrowserThemeRow>;
  isGuest: boolean;
}) {
  const bubbles = themes.find((t) => t.id === "nex-bubbles");
  const flat = themes.find((t) => t.id === "nex-flat");
  const freePair = [bubbles, flat].filter(
    (t): t is BrowserThemeRow => !!t,
  );
  if (freePair.length === 0) return null;
  return (
    <section
      aria-label="Free NEX themes"
      data-nex-space-free-pair
      style={{
        maxWidth: 720,
        margin: "0 auto 20px",
      }}
    >
      <div
        aria-hidden
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: "0 0 14px",
          fontSize: 10.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.cyan,
          fontWeight: 700,
        }}
      >
        <span style={{ flex: 1, height: 1, background: `${NEX.cyan}22` }} />
        <span>Your 2 free NEX themes</span>
        <span style={{ flex: 1, height: 1, background: `${NEX.cyan}22` }} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        {freePair.map((theme) => (
          <FreeNexPhone key={theme.id} theme={theme} isGuest={isGuest} />
        ))}
      </div>
    </section>
  );
}

function FreeNexPhone({
  theme,
  isGuest,
}: {
  theme: BrowserThemeRow;
  isGuest: boolean;
}) {
  const accent = theme.accent_hex;
  const rim = theme.bubble_rim_hex ?? accent;
  const composer = theme.composer_rim_hex ?? accent;
  const nextUrl = themePreviewHref(theme.id);
  // Step 1I re-seal (2026-10-11) · founder flipped the NEX New
  // "no chat text" rule · both free NEX phones now paint a full
  // live chat preview (profile header + varied bubbles) so visitors
  // see a real conversation in the theme's own palette. NEX New
  // keeps the ambient floating-bubbles treatment OVER the chat.
  const phoneBg = theme.hero_image_url
    ? `url("${encodeURI(theme.hero_image_url)}") center/cover, ${accent}`
    : theme.id === "nex-flat"
      ? `radial-gradient(circle at 50% 110%, ${NEX.cyanFaint} 0%, transparent 60%), linear-gradient(165deg, ${composer} 0%, ${rim} 40%, ${accent} 100%)`
      : `linear-gradient(165deg, ${accent} 0%, ${rim} 55%, ${composer} 100%)`;
  const showAmbientBubbles = theme.id === "nex-flat";
  const sampleMessages: readonly { text: string; mine: boolean }[] = [
    { text: "hey", mine: false },
    { text: "love this", mine: true },
    { text: "wow", mine: false },
    { text: "check themes on NEX 👆", mine: true },
  ];
  return (
    <div
      data-nex-space-free-phone={theme.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 12,
        borderRadius: 20,
        background: `linear-gradient(180deg, ${NEX.panelHi} 0%, ${NEX.panel} 100%)`,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      {/* Phone tap · same as "Preview {theme.name}" · opens the live
          chat preview via the Theme Engine (StandardExperience). The
          viewer sees sample messages painted in the theme's actual
          palette + ambient layers (floating bubbles · warm glow · etc). */}
      <Link
        href={nextUrl}
        aria-label={`Preview ${theme.name}`}
        style={{
          position: "relative",
          display: "block",
          aspectRatio: "9 / 18",
          margin: "0 auto",
          width: "70%",
          maxWidth: 150,
          borderRadius: 24,
          background: phoneBg,
          border: `2px solid ${rim}`,
          overflow: "hidden",
          textDecoration: "none",
          boxShadow: `0 10px 30px -16px rgba(0,0,0,0.6), 0 0 20px -12px ${accent}`,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 48,
            height: 6,
            borderRadius: 999,
            background: "rgba(2,9,20,0.75)",
          }}
        />
        {/* Phone top-header · matches the live chat shell: avatar
            with pink rim + name + three circular right-cluster
            buttons (Home · Shop · Cart) in NEX orange with pink
            cart dot. Same pattern as the category phones so Chat
            Themes feels unified. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 16,
            left: 6,
            right: 6,
            display: "flex",
            alignItems: "center",
            gap: 3,
            zIndex: 4,
          }}
        >
          <span
            style={{
              position: "relative",
              width: 14,
              height: 14,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${accent}, ${rim})`,
              color: "#021022",
              display: "grid",
              placeItems: "center",
              fontSize: 7,
              fontWeight: 800,
              flex: "none",
              border: "1px solid #FF3F9F",
              boxShadow: "0 0 4px rgba(255,63,159,0.55)",
            }}
          >
            N
          </span>
          <span
            style={{
              fontSize: 6.5,
              fontWeight: 700,
              color: "#F2F5F8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 1px 3px rgba(0,0,0,0.65)",
              flex: 1,
              minWidth: 0,
            }}
          >
            {theme.name}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              flex: "none",
            }}
          >
            {[
              {
                glyph: "⌂",
                key: "home",
                bg: "linear-gradient(180deg, #4FC3FF 0%, #00AFFF 100%)",
                border: "rgba(0,175,255,0.6)",
                shadow: "0 1px 3px rgba(0,175,255,0.35)",
              },
              {
                glyph: "🛍",
                key: "shop",
                bg: "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
                border: "rgba(255,120,0,0.6)",
                shadow: "0 1px 3px rgba(255,120,0,0.35)",
              },
              {
                glyph: "🛒",
                key: "cart",
                bg: "linear-gradient(180deg, #FF6DB5 0%, #FF3F9F 100%)",
                border: "rgba(255,63,159,0.6)",
                shadow: "0 1px 3px rgba(255,63,159,0.35)",
                hasBadge: true,
              },
            ].map((b) => (
              <span
                key={b.key}
                style={{
                  position: "relative",
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: b.bg,
                  border: `0.5px solid ${b.border}`,
                  color: "#0B0F1A",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 6,
                  fontWeight: 800,
                  boxShadow: b.shadow,
                }}
              >
                {b.glyph}
                {b.hasBadge && (
                  <span
                    style={{
                      position: "absolute",
                      top: -1.5,
                      right: -1.5,
                      width: 3.5,
                      height: 3.5,
                      borderRadius: 999,
                      background: "#F2F5F8",
                      border: "0.5px solid #0B0F1A",
                    }}
                  />
                )}
              </span>
            ))}
          </span>
        </div>
        {/* Ambient floating blue bubbles · NEX New only · layered
            BEHIND the chat preview rather than replacing it. */}
        {showAmbientBubbles && (
          <span aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 1 }}>
            {[
              { size: 10, left: "22%", bottom: "18%" },
              { size: 14, left: "60%", bottom: "28%" },
              { size: 8, left: "40%", bottom: "48%" },
              { size: 12, left: "70%", bottom: "62%" },
              { size: 6, left: "28%", bottom: "72%" },
              { size: 9, left: "55%", bottom: "82%" },
            ].map((b, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: b.left,
                  bottom: b.bottom,
                  width: b.size,
                  height: b.size,
                  borderRadius: 999,
                  background: NEX.cyan,
                  opacity: 0.55,
                  boxShadow: `0 0 ${b.size * 2}px ${NEX.cyan}66`,
                }}
              />
            ))}
          </span>
        )}
        {/* Live chat preview · four bubbles alternating peer / me so
            every free NEX phone paints a real conversation. Message
            copy sealed by the founder 2026-10-11. */}
        <div
          style={{
            position: "absolute",
            inset: "auto 6px 30px 6px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            zIndex: 3,
          }}
        >
          {sampleMessages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.mine ? "flex-end" : "flex-start",
                padding: "2.5px 6px",
                borderRadius: 999,
                maxWidth: "82%",
                // Step 1I re-seal · each theme's bubbles derive from
                // ITS OWN palette · peer uses primary (accent), me
                // uses secondary (rim) tinted · no two themes share
                // the same me-bubble color.
                background: m.mine
                  ? hexToRgba(rim, 0.78)
                  : `${accent}cc`,
                border: m.mine
                  ? `1px solid ${hexToRgba(rim, 0.95)}`
                  : "none",
                color: m.mine ? "#F2F5F8" : "#021022",
                fontSize: 7,
                fontWeight: m.mine ? 600 : 700,
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textShadow: m.mine ? "0 1px 2px rgba(0,0,0,0.5)" : undefined,
              }}
            >
              {m.text}
            </div>
          ))}
        </div>
        {/* Composer footer · theme-tinted pill with send glyph. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            bottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 3,
            padding: "2.5px 2.5px 2.5px 7px",
            borderRadius: 999,
            background: hexToRgba(accent, 0.16),
            border: `0.5px solid ${hexToRgba(accent, 0.4)}`,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 4,
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 6,
              color: "rgba(242,245,248,0.55)",
              fontStyle: "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Message…
          </span>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background:
                "linear-gradient(180deg, #FF9033 0%, #FF7800 100%)",
              border: "0.5px solid rgba(255,120,0,0.6)",
              color: "#0B0F1A",
              display: "grid",
              placeItems: "center",
              fontSize: 6,
              fontWeight: 800,
              flex: "none",
            }}
          >
            ➤
          </span>
        </div>
      </Link>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: NEX.text,
            marginBottom: 2,
          }}
        >
          {theme.name}
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Free · yours forever
        </div>
      </div>
      {/* "Explore →" navigates directly to the theme preview page ·
          same route the phone frame tap uses. Theme APPLICATION
          happens on the preview page via the sealed activate bar
          (session: posts updateChatThemeAction · guest: opens the
          pick-theme account wall). Keeping the two actions on
          separate surfaces fits the semantic: Explore = "take me
          there", This theme → = "apply it". */}
      <Link
        href={nextUrl}
        data-nex-space-free-explore={theme.id}
        style={freeUseLinkStyle(accent)}
      >
        Explore →
      </Link>
    </div>
  );
}

// ─── Free Trial 7 Days callout · lightweight pill-ish card ─────────
//
// Sits between the two free NEX phones and the Chat Themes grid.
// Rendered unconditionally for every viewer (session + guest). The
// trial state (active / unused / used) that the earlier
// TrySevenDaysFreeCard tracked lives in a separate account-settings
// flow now · this card is a top-of-funnel pointer to Try 7 days free,
// not an entitlement surface.

function FreeTrialSevenDaysCard() {
  return (
    <form
      action={startThemesTrialAction}
      data-nex-trial-card="offer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 14,
        background: `linear-gradient(180deg, ${NEX.orangeFaint} 0%, rgba(3,16,29,0.72) 100%)`,
        border: `1px solid ${NEX.orange}66`,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          padding: "3px 10px",
          borderRadius: 999,
          background: `linear-gradient(180deg, #FF9033 0%, ${NEX.orange} 100%)`,
          color: "#0B0F1A",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.14em",
          flex: "none",
        }}
      >
        FREE
      </span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: NEX.text,
            letterSpacing: "-0.005em",
            marginBottom: 2,
          }}
        >
          Free Trial 7 Days
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          Try any theme free for 7 days and impress your contacts.
          Just notice their reactions.
        </div>
      </div>
      <input type="hidden" name="package_id" value="bisnis" />
      <button
        type="submit"
        style={{
          padding: "8px 14px",
          borderRadius: 999,
          background:
            "linear-gradient(180deg, #FF9033 0%, #FF7200 100%)",
          border: `1px solid ${NEX.orange}99`,
          color: "#0B0F1A",
          fontSize: 11.5,
          fontWeight: 800,
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          flex: "none",
        }}
      >
        Start trial →
      </button>
    </form>
  );
}

/** Shared pill-link style for the "Explore →" CTA on each free NEX
 *  phone tile. Renders as an anchor (next/link) · navigates to the
 *  theme preview page where the activate bar applies the theme. */
function freeUseLinkStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 10,
    background: accent,
    color: "#021022",
    fontSize: 12.5,
    fontWeight: 700,
    border: `1px solid ${accent}`,
    textDecoration: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

/** Convert a hex colour (#RRGGBB or #RGB) to an rgba() string. Falls
 *  back to the input when parsing fails so the theme never renders
 *  a broken value. Used by the mini-phone preview bubbles so each
 *  theme's me-side bubble pulls from its own palette rather than a
 *  hardcoded navy. */
function hexToRgba(colour: string, alpha: number): string {
  const trimmed = colour.trim();
  if (trimmed.startsWith("#") && (trimmed.length === 7 || trimmed.length === 4)) {
    const hex =
      trimmed.length === 4
        ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
        : trimmed;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  const rgbaMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(",").map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return trimmed;
}
