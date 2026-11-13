// src/app/nex-native/chat-themes-library/_full-library-client.tsx
//
// NEX Chat Themes Library · full-library grid.
// Owner-authorised 2026-11-02.
// -----------------------------------------------------------------------------
// 2-per-row grid of every library theme · 20 per page · prev / next
// pagination at the footer. Opens from the entry page via "View full
// library". All Buy buttons open the shared placeholder sheet · no
// Stripe calls fire from here today.

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";
import type { EarnedBadges } from "@/lib/nex-native/creator/creator-badges";
import { UnifiedDrawer } from "@/components/nex-native/drawer/UnifiedDrawer";
import {
  LIBRARY_THEMES,
  formatDownloads,
  type LibraryTheme,
} from "./_catalog";
import { PaymentPlaceholderSheet } from "./_payment-sheet";
import { HeroPreview } from "./_hero-preview";

const PAGE_SIZE = 20;

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_ACCENT = "var(--nex-world-secondary, #C6A15B)";
const NEX_INK = "#F2F5F8";
const NEX_INK_DIM = "#B5C3D6";
const NEX_INK_MUTE = "#7D9BC0";

/** Owner directive 2026-11-13 · entitlement props threaded from the
 *  server page so the preview modal can render the correct CTA
 *  (Apply / First theme free / Subscribe to Themes+ / Join waitlist)
 *  without a round-trip when the modal opens. */
export interface LibraryEntitlementProps {
  /** `themes_plus_until > now()` on nex_account. */
  readonly themesPlusActive: boolean;
  /** Viewer has NO `source='first_free'` ownership row yet. */
  readonly canClaimFirstFree: boolean;
  /** Pre-formatted Themes+ monthly price for the viewer's region, or
   *  null when the region is not a launch market (shows waitlist CTA). */
  readonly themesPlusPriceLabel: string | null;
}

interface FullLibraryClientProps {
  readonly drawerSession: ControlDrawerSession | null;
  readonly viewerCreatorBadges: EarnedBadges;
  /** Owner directive 2026-11-11 · when provided, overrides the frozen
   *  LIBRARY_THEMES code catalog (171 entries) with the full set from
   *  the unified nex_background_asset table (450 entries · 279 shop +
   *  171 chat). Falls back to LIBRARY_THEMES when empty for safety. */
  readonly themesOverride?: readonly LibraryTheme[];
  /** Owner directive 2026-11-13 · Themes+ entitlement state for the
   *  signed-in viewer. Optional for backward compatibility; when
   *  omitted the modal falls back to its legacy "Apply" single CTA. */
  readonly entitlement?: LibraryEntitlementProps;
}

export function FullLibraryClient({
  drawerSession,
  viewerCreatorBadges,
  themesOverride,
  entitlement,
}: FullLibraryClientProps): React.JSX.Element {
  const ACTIVE_THEMES: readonly LibraryTheme[] =
    themesOverride && themesOverride.length > 0 ? themesOverride : LIBRARY_THEMES;
  // Owner-authorised 2026-11-03 · pagination is driven by `?page=N`
  // in the URL so each page gets its own shareable address + browser
  // back/forward respects history. Clamped to [1, totalPages].
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(ACTIVE_THEMES.length / PAGE_SIZE));
  const parsedPage = Number.parseInt(searchParams?.get("page") ?? "1", 10);
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 && parsedPage <= totalPages
      ? parsedPage - 1
      : 0;

  const [sheet, setSheet] = React.useState<LibraryTheme | null>(null);
  const [previewTheme, setPreviewTheme] = React.useState<LibraryTheme | null>(
    null,
  );
  // Scroll body back to top on every page change so page 2+ open at
  // the header, not at the leftover scroll from page 1.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [page]);

  const goToPage = React.useCallback(
    (next: number): void => {
      const clamped = Math.max(0, Math.min(totalPages - 1, next));
      const url =
        clamped === 0 ? pathname : `${pathname}?page=${clamped + 1}`;
      router.push(url);
    },
    [pathname, router, totalPages],
  );

  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const slice = ACTIVE_THEMES.slice(start, end);

  return (
    <>
      {/* Owner directive 2026-11-11 (Cycle 38) · top bar swapped from
          back-button to the shared NEX chrome used on Contacts:
          "Chat Themes" title (left) · black cart pill · black "+"
          drawer trigger (right). Supersedes the Cycle 37 back
          button. The CSS override below forces the inner
          UnifiedDrawer button to black bg + 32px square + white "+"
          (ControlDrawer's default triggerButtonStyle hard-codes
          orange + 40px). */}
      <style>{`
        [data-nex-chat-themes-global-drawer] button {
          background: #000000 !important;
          border: none !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45) !important;
          color: #FFFFFF !important;
          width: 32px !important;
          height: 32px !important;
          font-size: 20px !important;
        }
        [data-nex-chat-themes-global-drawer] svg {
          color: #FFFFFF !important;
          stroke: #FFFFFF !important;
          width: 14px !important;
          height: 14px !important;
        }
        [data-nex-chat-themes-global-drawer] svg * {
          stroke: #FFFFFF !important;
        }
      `}</style>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        {/* Owner directive 2026-11-11 · "Chat Themes" header title
            removed per request. Cart + "+" drawer trigger still sit
            at the right · spacer keeps the row layout balanced. */}
        <div style={{ flex: 1 }} />

        <Link
          href="/nex-native/cart"
          aria-label="Open shopping cart"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#000000",
            color: "#FFFFFF",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
          }}
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx={9} cy={21} r={1} />
            <circle cx={20} cy={21} r={1} />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
        </Link>
        {drawerSession ? (
          <span
            data-nex-chat-themes-global-drawer
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#000000",
              border: "none",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
              flexShrink: 0,
            }}
          >
            <UnifiedDrawer
              session={drawerSession}
              viewerEarnedBadges={viewerCreatorBadges}
            />
          </span>
        ) : null}
      </header>

      {/* Scrollable body · scrollRef drives scroll-to-top on page change.
          Owner directive 2026-11-03 · explicit width + min-width:0 so
          the grid respects the frame width and never horizontal-
          overflows on any page. */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          overflowX: "hidden",
          padding: "0 2px",
          WebkitOverflowScrolling: "touch",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: 18 }}>
          {/* Owner directive 2026-11-11 · eyebrow repainted BLACK
              for stronger contrast against the orange Full Library
              title. */}
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#000000",
              fontWeight: 800,
            }}
          >
            NEX Chat Themes
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 24,
              fontWeight: 700,
              // Owner directive 2026-11-11 (Cycle 37) · title repainted
              // NEX orange #FF7200 to read as a brand accent against
              // the dark emerald/navy library background.
              color: "#FF7200",
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.6)",
            }}
          >
            Full Library
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 12,
              color: NEX_INK_MUTE,
            }}
          >
            {ACTIVE_THEMES.length} themes · page {page + 1} of {totalPages}
          </p>
          {/* Owner directive 2026-11-11 · "Browse NEX Visual Library"
              CTA converted to a dropdown. Clicking the pill reveals the
              5 chat-wallpaper categories (Scenery / Patterns / Scenes
              / Pets / Luxury) plus an "All" option. Each option deep-
              links to the unified library at /library/backgrounds with
              the category pre-filtered. Same orange pill shape, now
              with a ▾ arrow. */}
          <BrowseLibraryDropdown />
        </header>

        <ul
          data-nex-library-full-grid
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            // Owner directive 2026-11-03 · strictly 2 cards per row ·
            // `minmax(0, 1fr)` tracks prevent long names from blowing
            // out either column. Width + min-width:0 on parents keeps
            // the grid inside the frame.
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 12,
            width: "100%",
            minWidth: 0,
          }}
        >
          {slice.map((t) => (
            <li key={t.id} style={{ minWidth: 0 }}>
              <ThemeCard
                theme={t}
                onBuy={() => setSheet(t)}
                onPreview={() => setPreviewTheme(t)}
                locked={
                  !!entitlement &&
                  !entitlement.themesPlusActive &&
                  !entitlement.canClaimFirstFree
                }
                firstFreeEligible={
                  !!entitlement &&
                  !entitlement.themesPlusActive &&
                  entitlement.canClaimFirstFree
                }
              />
            </li>
          ))}
        </ul>

        {/* Pagination · hidden when there's only one page but still
            rendered so the layout stays stable at the bottom. */}
        <nav
          aria-label="Pagination"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginTop: 24,
            paddingBottom: 10,
          }}
        >
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#000",
              border: "1px solid #000",
              color: "#FFFFFF",
              cursor: page === 0 ? "not-allowed" : "pointer",
              opacity: page === 0 ? 0.35 : 1,
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ‹
          </button>
          <span
            style={{
              fontSize: 12,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: NEX_INK_MUTE,
              minWidth: 70,
              textAlign: "center",
            }}
          >
            {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            aria-label="Next page"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages - 1}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#000",
              border: "1px solid #000",
              color: "#FFFFFF",
              cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
              opacity: page >= totalPages - 1 ? 0.35 : 1,
              fontSize: 20,
              lineHeight: 1,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ›
          </button>
        </nav>

        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 11,
            color: NEX_INK_MUTE,
            paddingBottom: 4,
          }}
        >
          Prices in euro · payment integration in progress.
        </p>
      </div>

      {sheet ? (
        <PaymentPlaceholderSheet
          onClose={() => setSheet(null)}
          title={`Buy ${sheet.label}`}
          description={`One-time purchase · €${sheet.oneTimePriceEUR.toFixed(2)}`}
        />
      ) : null}

      {previewTheme ? (
        <ApplyPreviewModal
          theme={previewTheme}
          onClose={() => setPreviewTheme(null)}
          entitlement={entitlement}
        />
      ) : null}
    </>
  );
}

// ─── Phone-frame preview modal ───────────────────────────────────────
// Owner directive 2026-11-03 · tap-to-preview opens a full-screen
// glass overlay with the HeroPreview phone frame loaded with the
// selected theme. User can tap backdrop / Esc / × to close, or Buy
// to swap into the payment placeholder.

/** Owner directive 2026-11-11 · FULL-SCREEN phone preview modal.
 *  Shows the selected theme as it would look on a chat phone (via
 *  HeroPreview) plus a footer with two buttons: "Use theme" (applies
 *  via applyFromLibraryChatAction) and "Close". */
function ApplyPreviewModal({
  theme,
  onClose,
  entitlement,
}: {
  readonly theme: LibraryTheme;
  readonly onClose: () => void;
  readonly entitlement?: LibraryEntitlementProps;
}): React.JSX.Element {
  const router = useRouter();
  const [applying, setApplying] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  // Owner directive 2026-11-13 · derive the CTA state from the
  // threaded entitlement props. Four branches:
  //   · themes-plus       → apply fires directly
  //   · first-free        → apply fires with claimFirstFree:true
  //   · subscribe (launch)→ Themes+ subscribe CTA (payment coming soon · Phase A)
  //   · waitlist          → non-launch region · payment surface not offered
  const ctaState: "themes_plus" | "first_free" | "subscribe" | "waitlist" =
    !entitlement
      ? "themes_plus" // legacy path · behave as before when entitlement not threaded
      : entitlement.themesPlusActive
        ? "themes_plus"
        : entitlement.canClaimFirstFree
          ? "first_free"
          : entitlement.themesPlusPriceLabel
            ? "subscribe"
            : "waitlist";
  // Owner directive 2026-11-11 · scale bar under the phone darkens the
  // wallpaper so the user can judge contrast before applying. 0 = no
  // overlay · 1 = fully black · default 0.
  const [darken, setDarken] = React.useState<number>(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleApply() {
    if (applying) return;
    setApplying(true);
    setResult(null);
    try {
      // LIBRARY_THEMES ids are unprefixed; the unified library chat
      // action expects the "chat:<id>" form so it resolves via
      // nex_background_asset. All 171 library ids were seeded under
      // that namespace in mig 337.
      const { applyFromLibraryChatAction } = await import(
        "@/app/nex-native/library/backgrounds/_actions"
      );
      // When the themesOverride has loaded from the unified catalog,
      // theme.id is already the fully-prefixed form (e.g.
      // "chat:library-ireland-1" or "shop:global-cart-glow"). For the
      // legacy frozen LIBRARY_THEMES array, ids are unprefixed and
      // need the "chat:" prefix prepended to match the seeded rows.
      const assetId = theme.id.includes(":") ? theme.id : `chat:${theme.id}`;
      // Owner directive 2026-11-13 · first-free grant. When the CTA
      // state is first_free, pass claimFirstFree:true so the action
      // writes the `nex_theme_ownership` source='first_free' row
      // before applying.
      const r = await applyFromLibraryChatAction(assetId, {
        claimFirstFree: ctaState === "first_free",
      });
      if (r.ok) {
        // Owner directive 2026-11-12 · on success, close the preview
        // and route to the chat screen so the user sees the newly
        // applied theme live. No success toast · the chat canvas
        // repainting with the new background is the confirmation.
        onClose();
        router.replace("/nex-native/free-chat");
        router.refresh();
        return;
      }
      setResult(`Could not apply · ${r.error}`);
    } catch (e) {
      setResult(`Could not apply · ${(e as Error).message}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${theme.label} preview`}
      data-nex-library-phone-preview
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        // Owner directive 2026-11-11 · modal bg flipped from Emerald
        // to Pale Ivory #F5EDD3 to match the library page background
        // (Ireland --nex-world-drawer-bg). One continuous cream
        // surface · header + phone body + footer all on the same
        // colour with no banding.
        background: "#F5EDD3",
      }}
    >
      {/* Invisible tap-anywhere dismiss behind the phone frame + footer */}
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 1,
        }}
      />

      {/* Header overlay · owner directive 2026-11-11 · title + download
          count sit ABOVE the phone on the cream modal base (not over
          the phone bezel). Ink switches back to black since they now
          paint on Pale Ivory, not on the dark wallpaper. */}
      <div
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
          left: 56,
          right: 56,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            color: "#000",
            textAlign: "center",
          }}
        >
          {theme.label}
        </h2>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: "#000",
          }}
        >
          <IconDownload size={13} />
          <span>{formatDownloads(theme.downloads)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: 12,
          zIndex: 4,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#FF7200",
          border: "1px solid rgba(0, 0, 0, 0.35)",
          color: "#1a0a00",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
        }}
      >
        ×
      </button>

      {/* Full-phone preview · owner directive 2026-11-11 · aspect kept
          at the sealed 9/18 so HeroPreview's header + bubble stream +
          composer render proportionally (shorter aspects squeezed the
          composer against the bezel). "Shorter phone" achieved by a
          smaller max width + vertical gap · scale bar + button fit
          below without clipping. */}
      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 72px) 24px calc(env(safe-area-inset-bottom, 0px) + 80px)",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        <div style={{ pointerEvents: "none" }}>
          <HeroPreview
            theme={theme}
            maxWidthCss="min(62vw, 240px, calc((100vh - 320px) * 9 / 18))"
            wallpaperDarken={darken}
          />
        </div>

        {/* Scale bar · darkens the wallpaper live · owner directive
            2026-11-11 · width matches the phone silhouette so the bar
            sits within the device's screen edges, not spilling past. */}
        <div
          style={{
            width: "min(62vw, 240px, calc((100vh - 320px) * 9 / 18))",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 12,
          }}
        >
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(darken * 100)}
            onChange={(e) =>
              setDarken(Math.min(1, Math.max(0, Number(e.target.value) / 100)))
            }
            aria-label="Darken wallpaper"
            data-nex-library-darken-slider
            style={{
              width: "100%",
              accentColor: "#FF7200",
              cursor: "pointer",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              fontWeight: 600,
              color: "#000",
              opacity: 0.7,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span>Light</span>
            <span>Dark</span>
          </div>
        </div>
      </div>

      {/* Floating CTA block · owner directive 2026-11-13 · renders one of
          four states derived from the entitlement props above. Apply /
          First-free trigger the server action directly · Subscribe is a
          payment-coming-soon CTA (Stripe not authorised yet) · Waitlist
          surfaces for non-launch regions and offers no payment path. */}
      <div
        data-nex-library-cta-block
        data-nex-library-cta-state={ctaState}
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 8,
        }}
      >
        {ctaState === "themes_plus" ? (
          <CtaPrimary
            label={applying ? "Applying..." : "Select Theme"}
            disabled={applying}
            onClick={handleApply}
          />
        ) : null}

        {ctaState === "first_free" ? (
          <CtaPrimary
            label={applying ? "Applying..." : "Apply · First theme free"}
            disabled={applying}
            onClick={handleApply}
            badge="Free"
          />
        ) : null}

        {ctaState === "subscribe" && entitlement?.themesPlusPriceLabel ? (
          <CtaSubscribePlaceholder
            priceLabel={entitlement.themesPlusPriceLabel}
          />
        ) : null}

        {ctaState === "waitlist" ? <CtaWaitlist /> : null}
      </div>

      {result ? (
        <div
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
            left: 0,
            right: 0,
            zIndex: 4,
            textAlign: "center",
            fontSize: 12,
            color: result.startsWith("Applied") ? "#16D66B" : "#FF6B6B",
          }}
        >
          {result}
        </div>
      ) : null}
    </div>
  );
}

// ─── CTA helpers for the preview modal · owner directive 2026-11-13 ─

function CtaPrimary({
  label,
  disabled,
  onClick,
  badge,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  badge?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-nex-library-apply="chat"
      style={{
        minHeight: 46,
        padding: "0 18px",
        borderRadius: 999,
        background: disabled ? "rgba(255,114,0,0.5)" : "#FF7200",
        color: "#FFFFFF",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontWeight: 900,
        fontSize: 13,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        boxShadow: "0 6px 18px rgba(255, 114, 0, 0.35)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l5 5 9-11" />
      </svg>
      <span>{label}</span>
      {badge ? (
        <span
          data-nex-library-apply-badge
          style={{
            marginLeft: 6,
            padding: "2px 7px",
            borderRadius: 999,
            background: "#16D66B",
            color: "#031018",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.12em",
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function CtaSubscribePlaceholder({
  priceLabel,
}: {
  priceLabel: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-library-subscribe-placeholder
      style={{
        padding: "12px 16px",
        borderRadius: 14,
        background: "#FFFFFF",
        border: "1px solid #FF7200",
        color: "#0A0608",
        boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#FF7200",
          color: "#FFFFFF",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 900,
        }}
      >
        +
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
          Subscribe to Themes+ · {priceLabel}/mo
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 11,
            color: "#7D5A3A",
            lineHeight: 1.35,
          }}
        >
          One subscription unlocks every paid chat theme. Payment opens shortly.
        </div>
      </div>
      <span
        aria-label="payment coming soon"
        style={{
          flexShrink: 0,
          padding: "2px 8px",
          borderRadius: 999,
          background: "rgba(255,114,0,0.14)",
          border: "1px solid #FF7200",
          color: "#FF7200",
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Soon
      </span>
    </div>
  );
}

function CtaWaitlist(): React.JSX.Element {
  return (
    <div
      data-nex-library-waitlist
      style={{
        padding: "12px 16px",
        borderRadius: 14,
        background: "#FFFFFF",
        border: "1px dashed #FF7200",
        color: "#0A0608",
        boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
        Not yet in your region
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 11,
          color: "#7D5A3A",
          lineHeight: 1.4,
        }}
      >
        Themes+ is rolling out in Ireland, UK, USA, Indonesia and Australia
        first. We&apos;ll let you know when your country goes live.
      </div>
    </div>
  );
}

/* Legacy PhonePreviewModal retained below · no longer rendered but
 * kept on disk · reversible if owner wants to restore the full-screen
 * phone-frame preview. */
function PhonePreviewModal({
  theme,
  onClose,
  onBuy,
}: {
  readonly theme: LibraryTheme;
  readonly onClose: () => void;
  readonly onBuy: () => void;
}): React.JSX.Element {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${theme.label} preview`}
      data-nex-library-phone-preview
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        // Owner directive 2026-11-03 (rev 5) · modal background is
        // Emerald so the wallpaper panel's rounded bottom corners
        // reveal Ireland green, which reads as the panel tucking
        // into the Emerald footer below.
        background: "var(--nex-world-drawer-bg, #123D2B)",
      }}
    >
      {/* Owner directive 2026-11-03 (rev 5) · glass backdrop retired ·
          it was painting over the Emerald everywhere, so the
          wallpaper panel's rounded bottom corners revealed glass
          grey, not Ireland green. Modal is now a clean Emerald base
          with the panel + footer flex-stacked on top. */}
      {/* Invisible tap-anywhere dismiss · lets the user close by
          tapping the Emerald edges / rounded-corner gaps around the
          wallpaper panel. Sits beneath panel + footer via zIndex. */}
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          zIndex: 1,
        }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 14px)",
          right: 14,
          width: 40,
          height: 40,
          borderRadius: "50%",
          // Owner directive 2026-11-03 · solid NEX Orange close
          // button · unified across every modal / sheet.
          background: "#FF7200",
          border: "1px solid rgba(0, 0, 0, 0.35)",
          color: "#1a0a00",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
          zIndex: 3,
        }}
      >
        ×
      </button>

      {/* Body · visible phone-shaped frame (rounded all four sides,
          dark bezel) · reads as a real phone silhouette. Owner
          directive 2026-11-03 (rev 6) · going back to the HeroPreview
          device mock so the user sees the PHONE SHAPE, not a full-
          bleed rectangle. Width capped by viewport width AND height
          so the phone fits comfortably above the Emerald footer. */}
      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          // Owner directive 2026-11-03 · phone anchored to the TOP of
          // the modal body so the chat-overlay header (avatar + name)
          // reads as a real header area at the top of the screen, not
          // sunk in the middle. Padding leaves just enough room for
          // the close × + safe-area at the top.
          justifyContent: "flex-start",
          padding: "calc(env(safe-area-inset-top, 0px) + 12px) 12px 0",
          overflow: "hidden",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <HeroPreview
          theme={theme}
          maxWidthCss="min(90vw, 360px, calc((100vh - 180px) * 9 / 18))"
        />
      </div>

      {/* Owner directive 2026-11-03 (rev 7) · no footer container ·
          name + downloads + Buy pill float directly on the Emerald
          modal base. No border, no background band · just centered
          elements with safe-area respect at the bottom. */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          flexShrink: 0,
          padding:
            "14px 20px calc(env(safe-area-inset-bottom, 0px) + 14px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: NEX_INK,
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
            textAlign: "center",
          }}
        >
          {theme.label}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: NEX_INK_MUTE,
          }}
        >
          {formatDownloads(theme.downloads)}
        </p>
        <button
          type="button"
          onClick={onBuy}
          style={{
            marginTop: 4,
            minHeight: 44,
            padding: "0 28px",
            borderRadius: 999,
            background: NEX_ACCENT,
            color: "#0a1a0a",
            border: `1px solid ${NEX_ACCENT}`,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            minWidth: 220,
          }}
        >
          Buy · €{theme.oneTimePriceEUR.toFixed(2)}
        </button>
      </div>
    </div>
  );
}

// ─── Tile · 2-per-row card ────────────────────────────────────────────

function ThemeCard({
  theme,
  onBuy,
  onPreview,
  locked,
  firstFreeEligible,
}: {
  readonly theme: LibraryTheme;
  readonly onBuy: () => void;
  readonly onPreview: () => void;
  /** Owner directive 2026-11-13 · viewer has no Themes+ access AND has
   *  already consumed their first-free perk · tile shows a lock
   *  indicator so they know Themes+ gates it. */
  readonly locked?: boolean;
  /** Owner directive 2026-11-13 · viewer still has their first-free
   *  perk available · tile shows a green "First free" badge instead
   *  of the lock. */
  readonly firstFreeEligible?: boolean;
}): React.JSX.Element {
  return (
    <article
      data-nex-library-full-tile={theme.id}
      data-nex-library-full-tile-locked={locked ? "true" : undefined}
      data-nex-library-full-tile-first-free={firstFreeEligible ? "true" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 8,
        borderRadius: 14,
        // Owner directive 2026-11-11 (Cycle 37) · theme tile bg
        // switched from translucent dark-navy to Ireland Gold
        // #C6A15B to match the WhatsApp invite button on the
        // Contacts page.
        background: "#C6A15B",
        border: `1px solid rgba(198, 161, 91, 0.6)`,
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Owner directive 2026-11-03 · tiles use a square cover (1:1)
          so page 2+3 fit comfortably on short viewports. The 4:5 cover
          made each tile ~25% taller than needed. Overlays on the image
          are the yellow NEW badge (top-right · isNew only) and the
          small orange Preview button (bottom-right). The price lives
          only on the Buy button below the tile. */}
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          aspectRatio: "1 / 1",
          backgroundColor: NEX_BG,
          boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={theme.wallpaperUrl}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        {theme.isNew ? (
          <span
            data-nex-library-tile-new-badge
            aria-label="New theme"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "3px 8px",
              borderRadius: 999,
              background: "#FFD24C",
              color: "#1a1200",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              lineHeight: 1,
              boxShadow: "0 2px 8px rgba(255, 210, 76, 0.55)",
              border: "1px solid rgba(255, 210, 76, 0.9)",
              zIndex: 1,
            }}
          >
            New
          </span>
        ) : null}
        {/* Owner directive 2026-11-13 · Themes+ gating badges (top-left).
            `firstFreeEligible` wins over `locked` because tapping the
            tile gives the user their free perk. */}
        {firstFreeEligible ? (
          <span
            data-nex-library-tile-first-free-badge
            aria-label="First theme free"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "3px 8px",
              borderRadius: 999,
              background: "#16D66B",
              color: "#031018",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              lineHeight: 1,
              boxShadow: "0 2px 8px rgba(22, 214, 107, 0.55)",
              border: "1px solid rgba(22, 214, 107, 0.9)",
              zIndex: 1,
            }}
          >
            Free
          </span>
        ) : locked ? (
          <span
            data-nex-library-tile-lock-badge
            aria-label="Themes+ required"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              padding: "3px 8px",
              borderRadius: 999,
              background: "#FF7200",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              lineHeight: 1,
              boxShadow: "0 2px 8px rgba(255, 114, 0, 0.55)",
              border: "1px solid rgba(255, 114, 0, 0.9)",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            🔒 Themes+
          </span>
        ) : null}
        {/* Owner-authorised 2026-11-03 · small orange Preview button ·
            bottom-right of the image · opens the phone-frame modal. */}
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview ${theme.label} in a phone`}
          data-nex-library-tile-preview
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#FF7200",
            color: "#1a0a00",
            border: "1px solid rgba(0, 0, 0, 0.35)",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 10px rgba(255, 114, 0, 0.5)",
            zIndex: 1,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      <h3
        style={{
          margin: "2px 0 0",
          fontSize: 13,
          fontWeight: 700,
          color: NEX_INK,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        {theme.label}
      </h3>
      {/* Owner directive 2026-11-11 · download count row · black
          ink + download icon · number only (no "downloads" word). */}
      <p
        style={{
          margin: 0,
          fontSize: 10,
          color: "#000000",
          lineHeight: 1.2,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontWeight: 700,
        }}
      >
        <svg
          width={10}
          height={10}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#000000"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {theme.downloads.toLocaleString("en-IE")}
      </p>
      {/* Owner directive 2026-11-11 · free-pool themes display "Free"
          · all other themes keep the one-time price pill. Button
          chrome · black background + NEX orange ink/border. */}
      <button
        type="button"
        onClick={onBuy}
        aria-label={
          FREE_POOL_THEME_IDS.has(theme.id)
            ? `Apply ${theme.label} free`
            : `Buy ${theme.label} for €${theme.oneTimePriceEUR.toFixed(2)}`
        }
        style={{
          marginTop: 2,
          minHeight: 32,
          padding: "0 10px",
          borderRadius: 999,
          background: "#000000",
          color: "#FF7200",
          border: "1px solid #FF7200",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          letterSpacing: "0.04em",
          // Owner directive 2026-11-11 · keep "Buy · €3.99" on ONE
          // line · never wrap to a second row.
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}
      >
        {FREE_POOL_THEME_IDS.has(theme.id)
          ? "Free"
          : `Buy · €${theme.oneTimePriceEUR.toFixed(2)}`}
      </button>
    </article>
  );
}

/** Owner-approved free-pool theme ids (Phase 1 unified library) ·
 *  appear as "Free" on the library tiles instead of the one-time
 *  price. Source of truth: migration 337 seed · see also
 *  src/lib/nex-native/library/catalog-service.ts. */
const FREE_POOL_THEME_IDS = new Set<string>([
  "library-ireland-1",
  "library-pattern-2",
  "library-pets-1",
]);

/** Owner directive 2026-11-11 · world-class category dropdown.
 *  Categories derived from a live scan of all 450 assets in
 *  nex_background_asset · ordered by count (largest first) so users
 *  hit the most popular groups first. Each option deep-links to
 *  /library/backgrounds with the category pre-selected. */
interface BrowseOption {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly icon: (color: string) => React.JSX.Element;
}

// Professional stroke-icon set · 16px · lucide/feather style.
function Icon({ d, size = 16 }: { d: string; size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
function IconGrid() { return <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />; }
function IconMountain() { return <Icon d="M8 3l-6 12h12zM14 9l-4 10h14zM16 3v2" />; }
function IconShirt() { return <Icon d="M20 7l-5-4-3 2-3-2-5 4 2 3h2v9h10V10h2z" />; }
function IconUtensils() { return <Icon d="M4 3v10a3 3 0 006 0V3M7 11v10M14 3c-2 0-3 3-3 6s1 4 3 4v8M14 7h4" />; }
function IconGem() { return <Icon d="M12 2l10 8-10 12L2 10zM12 2l-5 8h10zM2 10h20" />; }
function IconSparkles() { return <Icon d="M12 3v3M12 18v3M4 12h3M17 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />; }
function IconWrench() { return <Icon d="M14 6l-2 2-4-4-4 4 4 4 2-2 8 8-2 2-4-4-2 2 4 4 2-2 4-4-10-10z" />; }
function IconPlane() { return <Icon d="M22 2L2 12l7 2 2 7 11-19zM11 14l6-6" />; }
function IconLaptop() { return <Icon d="M3 7h18v10H3zM2 20h20M8 11h8" />; }
function IconTag() { return <Icon d="M21 12l-9 9-9-9V3h9zM8 8h0" />; }
function IconPaw() { return <Icon d="M7 10c0-2-1-3-2-3s-2 1-2 3 1 3 2 3 2-1 2-3zM11 6c0-2-1-3-2-3S7 4 7 6s1 3 2 3 2-1 2-3zM17 6c0-2-1-3-2-3s-2 1-2 3 1 3 2 3 2-1 2-3zM21 10c0-2-1-3-2-3s-2 1-2 3 1 3 2 3 2-1 2-3zM12 12c-4 0-6 4-6 7 0 2 2 3 6 3s6-1 6-3c0-3-2-7-6-7z" />; }
function IconPattern() { return <Icon d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6zM9 9l6 6M15 9l-6 6" />; }
function IconDownload({ size = 14 }: { size?: number } = {}) {
  return <Icon d="M12 3v12M6 11l6 6 6-6M4 21h16" size={size} />;
}

const BROWSE_OPTIONS: ReadonlyArray<BrowseOption> = [
  { id: "all",         label: "All wallpapers", count: 450, icon: () => <IconGrid /> },
  { id: "luxury",      label: "Luxury",         count: 97,  icon: () => <IconGem /> },
  { id: "fashion",     label: "Fashion",        count: 72,  icon: () => <IconShirt /> },
  { id: "food",        label: "Food & Drink",   count: 65,  icon: () => <IconUtensils /> },
  { id: "scenery",     label: "Scenery",        count: 59,  icon: () => <IconMountain /> },
  { id: "showcase",    label: "Showcase",       count: 49,  icon: () => <IconSparkles /> },
  { id: "tools",       label: "Tools & Trade",  count: 35,  icon: () => <IconWrench /> },
  { id: "travel",      label: "Travel",         count: 18,  icon: () => <IconPlane /> },
  { id: "electronics", label: "Electronics",    count: 16,  icon: () => <IconLaptop /> },
  { id: "sale",        label: "Sale",           count: 7,   icon: () => <IconTag /> },
  { id: "pets",        label: "Pets",           count: 4,   icon: () => <IconPaw /> },
  { id: "pattern",     label: "Patterns",       count: 3,   icon: () => <IconPattern /> },
];

function BrowseLibraryDropdown(): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const returnTo = encodeURIComponent("/nex-native/chat-themes-library/all");

  return (
    <div
      ref={rootRef}
      data-nex-chat-library-cta
      style={{
        position: "relative",
        display: "inline-block",
        marginTop: 10,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 999,
          background: "#FF7200",
          color: "#FFFFFF",
          border: "none",
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span>Browse NEX Visual Library</span>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            transition: "transform 150ms ease-out",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            lineHeight: 1,
            fontSize: 10,
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: 260,
            maxHeight: "min(70vh, 460px)",
            overflowY: "auto",
            background: "#0A1526",
            border: `1px solid ${NEX_ACCENT}55`,
            borderRadius: 14,
            padding: 6,
            boxShadow: "0 16px 40px rgba(0,0,0,0.65)",
            zIndex: 20,
            // Subtle chrome header inside the menu
          }}
        >
          <div
            style={{
              padding: "8px 12px 10px",
              borderBottom: `1px solid rgba(255,255,255,0.08)`,
              marginBottom: 4,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Browse by category
          </div>
          {BROWSE_OPTIONS.map((opt) => (
            <Link
              key={opt.id}
              role="menuitem"
              href={`/nex-native/library/backgrounds?context=chat${
                opt.id === "all" ? "" : `&category=${encodeURIComponent(opt.id)}`
              }&returnTo=${returnTo}`}
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                color: NEX_INK,
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.01em",
                textAlign: "left",
                transition: "background 120ms ease-out, color 120ms ease-out",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,114,0,0.14)";
                e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = NEX_INK;
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(255,114,0,0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FF7200",
                  flexShrink: 0,
                }}
              >
                {opt.icon("#FF7200")}
              </span>
              <span style={{ flex: 1 }}>{opt.label}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.45)",
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {opt.count}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
