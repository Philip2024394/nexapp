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

export function FullLibraryClient(): React.JSX.Element {
  // Owner-authorised 2026-11-03 · pagination is driven by `?page=N`
  // in the URL so each page gets its own shareable address + browser
  // back/forward respects history. Clamped to [1, totalPages].
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(LIBRARY_THEMES.length / PAGE_SIZE));
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
  const slice = LIBRARY_THEMES.slice(start, end);

  return (
    <>
      {/* Top bar · back to entry */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <Link
          href="/nex-native/chat-themes-library"
          aria-label="Back to entry"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(6, 15, 28, 0.72)",
            border: `1px solid ${NEX_ACCENT}`,
            color: NEX_INK,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            lineHeight: 1,
          }}
        >
          <span aria-hidden>←</span>
          <span>Back</span>
        </Link>
        <span style={{ width: 60 }} />
      </div>

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
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: NEX_INK_MUTE,
            }}
          >
            NEX Chat Themes
          </p>
          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 24,
              fontWeight: 700,
              color: NEX_INK,
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
            {LIBRARY_THEMES.length} themes · page {page + 1} of {totalPages}
          </p>
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
              background: "rgba(6, 15, 28, 0.72)",
              border: `1px solid ${NEX_ACCENT}`,
              color: NEX_INK,
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
              background: "rgba(6, 15, 28, 0.72)",
              border: `1px solid ${NEX_ACCENT}`,
              color: NEX_INK,
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
        <PhonePreviewModal
          theme={previewTheme}
          onClose={() => setPreviewTheme(null)}
          onBuy={() => {
            const t = previewTheme;
            setPreviewTheme(null);
            setSheet(t);
          }}
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
}: {
  readonly theme: LibraryTheme;
  readonly onBuy: () => void;
  readonly onPreview: () => void;
}): React.JSX.Element {
  return (
    <article
      data-nex-library-full-tile={theme.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 8,
        borderRadius: 14,
        background: "rgba(6, 15, 28, 0.72)",
        border: `1px solid rgba(198, 161, 91, 0.22)`,
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
      <p
        style={{
          margin: 0,
          fontSize: 10,
          color: NEX_INK_MUTE,
          lineHeight: 1.2,
        }}
      >
        {formatDownloads(theme.downloads)}
      </p>
      <button
        type="button"
        onClick={onBuy}
        aria-label={`Buy ${theme.label} for €${theme.oneTimePriceEUR.toFixed(2)}`}
        style={{
          marginTop: 2,
          minHeight: 32,
          padding: "0 10px",
          borderRadius: 999,
          background: "transparent",
          color: NEX_INK,
          border: `1px solid ${NEX_ACCENT}`,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Buy · €{theme.oneTimePriceEUR.toFixed(2)}
      </button>
    </article>
  );
}
