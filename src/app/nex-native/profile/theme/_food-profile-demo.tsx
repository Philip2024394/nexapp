// src/app/nex-native/profile/theme/_food-profile-demo.tsx
//
// NEX Food profile type · demo-only mode · owner-approved 2026-10-18.
// --------------------------------------------------------------------
// Full-screen hero takeover for a food-type chat theme preview. Shows
// the THEME's identity (not a real business). Every data section is
// a clearly-labelled DEMO placeholder · no invented menu items · no
// invented business · no Order/Call/Message actions.
//
// Why demo-only? A chat theme is shared by many businesses · auto-
// picking "the" business would be wrong by design (audit 2026-10-18
// confirms no "primary business" convention exists on nex_business).
// Real business profiles belong on a future `/business/[slug]` route
// that resolves ONE explicit business · this file never does.
//
// Hard rules (per owner directive):
//   · NO Order button · NO Call button · NO Message button
//     (those actions require a real business + verified contact
//     target · demo mode must not fake them)
//   · NO invented menu-item names · placeholder cards labelled
//     "Example dish" so the layout can be seen without implying
//     a real menu
//   · Clearly-labelled DEMO banner at the top of the content area
//     so visitors always know this is a theme preview, not a
//     business profile
//
// Reuses NEX's sealed navigation + share patterns:
//   · Close · returns to the chat preview the viewer came from
//     (document.referrer check) · falls back to the themes gallery
//   · Share · navigator.share() with clipboard-copy fallback (same
//     pattern used by _first-contact-share-handle, _nex-id-share,
//     _calls-client, _preview-shell · 4+ sealed surfaces)
//
// Client Component · owns referrer check + share action.

"use client";

import * as React from "react";
import Link from "next/link";

interface FoodProfileDemoProps {
  readonly themeId: string;
  readonly themeName: string;
  readonly tagline: string | null;
  readonly wallpaperUrl: string | null;
  readonly accentHex: string;
}

const NEX = {
  bg: "#020914",
  text: "#F2F5F8",
  textMuted: "#B5C3D6",
  textDim: "#7D9BC0",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function FoodProfileDemo(
  props: FoodProfileDemoProps,
): React.JSX.Element {
  const accent = props.accentHex;

  /* Owner directive 2026-10-18 · Close destination logic.
     Reads document.referrer on mount · if viewer came from the
     themed chat preview (/nex-native/themes/[themeId]) return there ·
     else fall back to the sealed themes gallery (verified existing
     route). Never routes to a 404. */
  const closeHref = useCloseDestination(props.themeId);

  /* Owner directive 2026-10-18 · Share uses sealed NEX pattern ·
     navigator.share() when available · clipboard-copy fallback with
     ephemeral toast when not. */
  const { onShare, toast } = useShareAction({
    title: props.themeName,
    themeId: props.themeId,
  });

  return (
    <main
      data-nex-profile-root
      data-nex-profile-mode="theme"
      data-nex-profile-theme-id={props.themeId}
      data-nex-profile-food-demo="true"
      style={{
        position: "relative",
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        ["--nex-profile-accent" as unknown as string]: accent,
      }}
    >
      {/* HERO · full-screen wallpaper (if theme has one · else
          themed gradient) · overlay chrome + identity. */}
      <HeroSection
        wallpaperUrl={props.wallpaperUrl}
        themeName={props.themeName}
        tagline={props.tagline}
        accent={accent}
        closeHref={closeHref}
        onShare={onShare}
      />

      {/* DEMO banner · unambiguous "this is not a real business"
          marker. role="status" announces to screen readers that
          the content below is demonstrative. */}
      <div
        role="status"
        data-nex-food-demo-banner
        style={{
          margin: "16px 14px 0",
          padding: "10px 14px",
          borderRadius: 10,
          background: `${accent}1A`,
          border: `1px solid ${accent}55`,
          color: NEX.text,
          fontSize: 12,
          lineHeight: 1.4,
        }}
      >
        <strong style={{ color: accent, letterSpacing: "0.08em" }}>
          THEME PREVIEW
        </strong>{" "}
        · demo content only · no linked business. The real menu, hours
        and ordering appear once a food business links this theme.
      </div>

      {/* SIGNATURE DISHES · 3 placeholder cards · each labelled DEMO.
          Owner directive · "clearly identified demo content" · no
          invented food names · just "Example dish N". */}
      <Section title="Signature dishes" accent={accent}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {[1, 2, 3].map((n) => (
            <DemoDishCard
              key={n}
              label={`Example dish ${n}`}
              wallpaperUrl={props.wallpaperUrl}
              accent={accent}
            />
          ))}
        </div>
      </Section>

      {/* FULL MENU · 2-column grid of 4 placeholder cards. */}
      <Section title="Menu" accent={accent}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {[1, 2, 3, 4].map((n) => (
            <DemoMenuCard
              key={n}
              label={`Example item ${n}`}
              wallpaperUrl={props.wallpaperUrl}
              accent={accent}
            />
          ))}
        </div>
      </Section>

      {/* PLACEHOLDER sections · what a real business will show. */}
      <PlaceholderSection
        title="Opening hours"
        body="Opening hours shown here when a food business links this theme."
        accent={accent}
      />
      <PlaceholderSection
        title="Location"
        body="Business address and map shown here when a food business links this theme."
        accent={accent}
      />
      <PlaceholderSection
        title="Payment methods"
        body="Accepted payment methods appear here · set by each business."
        accent={accent}
      />

      <div style={{ height: 32 }} />

      {toast}
    </main>
  );
}

// ─── Hero section ─────

function HeroSection({
  wallpaperUrl,
  themeName,
  tagline,
  accent,
  closeHref,
  onShare,
}: {
  wallpaperUrl: string | null;
  themeName: string;
  tagline: string | null;
  accent: string;
  closeHref: string;
  onShare: () => void;
}): React.JSX.Element {
  return (
    <div
      data-nex-food-hero
      style={{
        position: "relative",
        width: "100%",
        /* 68vh hero · leaves ~32vh of content below the fold on
           mobile so viewers see there is more without having to
           scroll past a full-screen takeover. */
        minHeight: "68vh",
        background: wallpaperUrl
          ? `#000`
          : `linear-gradient(135deg, ${accent}44 0%, #020914 100%)`,
        overflow: "hidden",
      }}
    >
      {wallpaperUrl ? (
        <img
          src={wallpaperUrl}
          alt=""
          aria-hidden
          data-nex-food-hero-image
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            userSelect: "none",
          }}
        />
      ) : null}

      {/* Bottom gradient scrim for text legibility */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0) 40%, rgba(2,9,20,0.72) 85%, rgba(2,9,20,0.95) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* OVERLAY CHROME · Close top-left · Share top-right */}
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 2,
        }}
      >
        <Link
          href={closeHref}
          data-nex-food-close
          aria-label="Close theme preview"
          style={pillOverlayStyle(accent)}
        >
          <CloseGlyph /> Close
        </Link>
        <button
          type="button"
          onClick={onShare}
          data-nex-food-share
          aria-label="Share this theme"
          style={pillOverlayStyle(accent)}
        >
          <ShareGlyph /> Share
        </button>
      </div>

      {/* IDENTITY · bottom third · overlay */}
      <div
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 20,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          data-nex-food-eyebrow
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: accent,
          }}
        >
          Chat Theme
        </div>
        <h1
          data-nex-food-name
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.1,
            color: NEX.text,
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
          }}
        >
          {themeName}
        </h1>
        {tagline && (
          <div
            data-nex-food-tagline
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: NEX.textMuted,
              textShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          >
            {tagline}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section wrappers ─────

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      data-nex-food-section={title}
      style={{
        padding: "20px 14px 0",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlaceholderSection({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: string;
}): React.JSX.Element {
  return (
    <Section title={title} accent={accent}>
      <div
        data-nex-food-placeholder={title}
        style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px dashed rgba(255,255,255,0.12)",
          color: NEX.textDim,
          fontSize: 13,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}
      >
        {body}
      </div>
    </Section>
  );
}

// ─── Demo cards · signature + menu ─────

function DemoDishCard({
  label,
  wallpaperUrl,
  accent,
}: {
  label: string;
  wallpaperUrl: string | null;
  accent: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-food-card="signature"
      style={{
        position: "relative",
        aspectRatio: "1 / 1",
        borderRadius: 12,
        overflow: "hidden",
        background: wallpaperUrl
          ? `center/cover url(${wallpaperUrl})`
          : `linear-gradient(135deg, ${accent}44, #020914)`,
        border: `1px solid ${accent}55`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(2,9,20,0) 55%, rgba(2,9,20,0.85) 100%)",
        }}
      />
      <span
        data-nex-food-card-demo
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          padding: "2px 6px",
          borderRadius: 6,
          background: accent,
          color: "#020914",
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.14em",
        }}
      >
        DEMO
      </span>
      <div
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: 8,
          fontSize: 11,
          fontWeight: 700,
          color: NEX.text,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function DemoMenuCard({
  label,
  wallpaperUrl,
  accent,
}: {
  label: string;
  wallpaperUrl: string | null;
  accent: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-food-card="menu"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(3, 16, 29, 0.65)",
        border: `1px solid ${accent}44`,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          background: wallpaperUrl
            ? `center/cover url(${wallpaperUrl})`
            : `linear-gradient(135deg, ${accent}33, #020914)`,
        }}
      >
        <span
          data-nex-food-card-demo
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            padding: "2px 6px",
            borderRadius: 6,
            background: accent,
            color: "#020914",
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.14em",
          }}
        >
          DEMO
        </span>
      </div>
      <div
        style={{
          padding: "8px 10px 10px",
          fontSize: 12,
          fontWeight: 700,
          color: NEX.text,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ─── Overlay pill style ─────

function pillOverlayStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(2, 9, 20, 0.55)",
    border: `1px solid ${accent}66`,
    color: NEX.text,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: SANS,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };
}

// ─── Icons ─────

function CloseGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function ShareGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
      <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
    </svg>
  );
}

// ─── Hooks · Close destination + Share action ─────

/** Owner directive 2026-10-18 · prefer the themed chat preview as
 *  the Close destination when the viewer arrived from there · else
 *  fall back to the themes gallery (sealed existing route verified
 *  by the 2026-10-18 audit · never routes to a 404). */
function useCloseDestination(themeId: string): string {
  const [href, setHref] = React.useState<string>(
    "/nex-native/themes/gallery",
  );
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const ref = document.referrer;
    if (!ref) {
      setHref("/nex-native/themes/gallery");
      return;
    }
    try {
      const u = new URL(ref);
      if (u.pathname === `/nex-native/themes/${themeId}`) {
        setHref(u.pathname + u.search);
      } else {
        setHref("/nex-native/themes/gallery");
      }
    } catch {
      setHref("/nex-native/themes/gallery");
    }
  }, [themeId]);
  return href;
}

/** Owner directive 2026-10-18 · reuse NEX's sealed share pattern ·
 *  navigator.share() when supported · clipboard-copy + ephemeral
 *  toast otherwise. Same pattern used across _first-contact-share-
 *  handle · _nex-id-share · _calls-client · _preview-shell. */
function useShareAction({
  title,
  themeId,
}: {
  title: string;
  themeId: string;
}): { onShare: () => void; toast: React.ReactNode } {
  const [showToast, setShowToast] = React.useState(false);

  const onShare = React.useCallback(() => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/nex-native/profile/theme/${encodeURIComponent(themeId)}`
        : `/nex-native/profile/theme/${encodeURIComponent(themeId)}`;
    const text = `Explore the ${title} theme on NEX`;
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (nav && typeof nav.share === "function") {
      nav.share({ title, text, url }).catch(() => {
        void copyFallback(url);
      });
      return;
    }
    void copyFallback(url);

    async function copyFallback(u: string): Promise<void> {
      try {
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
          await nav.clipboard.writeText(u);
          setShowToast(true);
          window.setTimeout(() => setShowToast(false), 2200);
        }
      } catch {
        /* silent · nothing to do · owner directive · no error toast */
      }
    }
  }, [themeId, title]);

  const toast = showToast ? (
    <div
      role="status"
      aria-live="polite"
      data-nex-food-share-toast
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "8px 14px",
        borderRadius: 999,
        background: "rgba(2, 9, 20, 0.92)",
        color: NEX.text,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid rgba(255,255,255,0.14)",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      Link copied
    </div>
  ) : null;

  return { onShare, toast };
}
